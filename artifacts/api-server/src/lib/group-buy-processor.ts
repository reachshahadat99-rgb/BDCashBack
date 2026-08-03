/**
 * Group Buy campaign settlement processor.
 *
 * Runs periodically (same scheduler pattern as releaseMatureCashback).
 * For each expired open campaign:
 *  - SUCCESS (joinedCount >= minParticipants): collect remaining balance,
 *    mark orders fulfilled, issue pending cashback (50 % customer share).
 *  - FAILED (joinedCount < minParticipants): refund all deposits to wallets,
 *    mark orders refunded.
 *
 * Each campaign is processed in its own transaction with a FOR UPDATE lock on
 * the deal row, so concurrent scheduler runs are safe.
 */

import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  db,
  groupBuyDealsTable,
  groupBuyOrdersTable,
  walletSnapshotsTable,
  walletTransactionsTable,
} from "@workspace/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { recordedPaymentService as paymentService } from "./payments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

const money = (v: string | number | null | undefined) => Number(v ?? 0);

/** Ensure a wallet snapshot row exists for the user inside a transaction. */
async function ensureSnapshot(tx: Tx, userId: string) {
  await tx
    .insert(walletSnapshotsTable)
    .values({
      id: userId,
      balance: "0.00",
      pendingCashback: "0.00",
      availableCashback: "0.00",
      rewardPoints: "0",
    })
    .onConflictDoNothing();
}

/**
 * Process a single expired campaign inside a transaction.
 * Returns false if the campaign was already processed (idempotent).
 */
async function settleExpiredCampaign(dealId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Lock the deal — only proceed if still "open"
    const [deal] = await tx
      .select()
      .from(groupBuyDealsTable)
      .where(
        and(
          eq(groupBuyDealsTable.id, dealId),
          eq(groupBuyDealsTable.status, "open"),
        ),
      )
      .for("update")
      .limit(1);

    if (!deal) return false; // Already settled or not found

    // Count reserved participants
    const [progress] = await tx
      .select({
        joined: sql<number>`coalesce(sum(${groupBuyOrdersTable.quantity}), 0)`.mapWith(
          Number,
        ),
      })
      .from(groupBuyOrdersTable)
      .where(
        and(
          eq(groupBuyOrdersTable.dealId, dealId),
          eq(groupBuyOrdersTable.status, "reserved"),
        ),
      );

    const joined = progress?.joined ?? 0;
    const meetsMinimum = joined >= deal.minParticipants;

    if (meetsMinimum) {
      // ------------------------------------------------------------------ //
      // SUCCESS path
      // ------------------------------------------------------------------ //
      await tx
        .update(groupBuyDealsTable)
        .set({ status: "success" })
        .where(eq(groupBuyDealsTable.id, dealId));

      const reservedOrders = await tx
        .select()
        .from(groupBuyOrdersTable)
        .where(
          and(
            eq(groupBuyOrdersTable.dealId, dealId),
            eq(groupBuyOrdersTable.status, "reserved"),
          ),
        );

      for (const order of reservedOrders) {
        const dueAmount = money(order.dueAmount);

        // Attempt to collect remaining balance
        let balanceRef: string | null = null;
        if (dueAmount > 0) {
          try {
            const charge = await paymentService.charge({
              customerId: order.customerId,
              amount: dueAmount,
              method: order.paymentMethod as "bkash" | "nagad" | "card",
              purpose: `group-buy-balance:${dealId}:${order.id}`,
            });
            balanceRef = charge.reference;
          } catch {
            // Balance collection failed — mark for manual follow-up and skip cashback
            await tx
              .update(groupBuyOrdersTable)
              .set({ status: "payment_failed" })
              .where(eq(groupBuyOrdersTable.id, order.id));
            continue;
          }
        }

        // Mark order as fulfilled
        await tx
          .update(groupBuyOrdersTable)
          .set({
            status: "fulfilled",
            ...(balanceRef ? { paymentRef: balanceRef } : {}),
          })
          .where(eq(groupBuyOrdersTable.id, order.id));

        // Issue pending cashback — customer receives 50 % of the cashback
        // (platform retains the other 50 % as revenue).
        const totalAmount = money(order.totalAmount);
        const cashbackPercent = money(deal.cashbackPercent);
        const cashback = Math.round((totalAmount * cashbackPercent) / 100 / 2);

        if (cashback > 0) {
          const now = new Date();
          await ensureSnapshot(tx, order.customerId);

          await tx.insert(walletTransactionsTable).values({
            id: nanoid(),
            userId: order.customerId,
            type: "cashback_pending",
            amount: String(cashback),
            description: `Group buy cashback pending — ${deal.title}`,
            referenceId: dealId,
            referenceType: "group_buy",
          });

          await tx
            .update(walletSnapshotsTable)
            .set({
              pendingCashback: sql`${walletSnapshotsTable.pendingCashback} + ${cashback}`,
              updatedAt: now,
            })
            .where(eq(walletSnapshotsTable.id, order.customerId));
        }
      }
    } else {
      // ------------------------------------------------------------------ //
      // FAILED path — refund all deposits
      // ------------------------------------------------------------------ //
      await tx
        .update(groupBuyDealsTable)
        .set({ status: "failed" })
        .where(eq(groupBuyDealsTable.id, dealId));

      const reservedOrders = await tx
        .select()
        .from(groupBuyOrdersTable)
        .where(
          and(
            eq(groupBuyOrdersTable.dealId, dealId),
            eq(groupBuyOrdersTable.status, "reserved"),
          ),
        );

      for (const order of reservedOrders) {
        const deposit = money(order.depositPaid);

        await tx
          .update(groupBuyOrdersTable)
          .set({ status: "refunded" })
          .where(eq(groupBuyOrdersTable.id, order.id));

        if (deposit > 0) {
          const now = new Date();
          await ensureSnapshot(tx, order.customerId);

          await tx.insert(walletTransactionsTable).values({
            id: nanoid(),
            userId: order.customerId,
            type: "refund",
            amount: String(deposit),
            description: `Group buy deposit refunded — ${deal.title} did not reach minimum participants`,
            referenceId: dealId,
            referenceType: "group_buy",
          });

          await tx
            .update(walletSnapshotsTable)
            .set({
              // Refunded deposit lands in available balance (spendable immediately)
              balance: sql`${walletSnapshotsTable.balance} + ${deposit}`,
              availableCashback: sql`${walletSnapshotsTable.availableCashback} + ${deposit}`,
              updatedAt: now,
            })
            .where(eq(walletSnapshotsTable.id, order.customerId));
        }
      }
    }

    return true;
  });
}

/**
 * Settle all expired open campaigns.
 * Each campaign is processed independently so one failure does not block others.
 */
export async function processExpiredGroupBuyCampaigns(): Promise<number> {
  const now = new Date();

  const expired = await db
    .select({ id: groupBuyDealsTable.id })
    .from(groupBuyDealsTable)
    .where(
      and(
        eq(groupBuyDealsTable.status, "open"),
        sql`${groupBuyDealsTable.endsAt} <= ${now}`,
      ),
    );

  let settled = 0;
  for (const { id } of expired) {
    try {
      const ok = await settleExpiredCampaign(id);
      if (ok) settled++;
    } catch {
      // Log per-campaign errors without aborting the batch
    }
  }
  return settled;
}
