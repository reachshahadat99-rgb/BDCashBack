/**
 * Group Buy domain — deal listing, reservation flow, campaign views.
 *
 * Owns: groupBuyDealsTable, groupBuyOrdersTable
 * Seed data lives here; ensureSeeded is idempotent and called from routes.
 */

import { and, eq, sql } from "drizzle-orm";
import {
  db,
  groupBuyDealsTable,
  groupBuyOrdersTable,
  type GroupBuyDeal as GroupBuyDealRow,
} from "@workspace/db";
import { recordedPaymentService as paymentService } from "../../lib/payments";
import { money } from "../../lib/money";

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const dealSeed = [
  {
    id: "gb-galaxy-a55",
    title: "Samsung Galaxy A55",
    image:
      "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=600&q=80",
    category: "Electronics",
    originalPrice: "44990",
    groupPrice: "34990",
    cashbackPercent: "8",
    depositPercent: "20",
    minParticipants: 50,
    endsAt: new Date("2026-08-06T18:00:00.000Z"),
  },
  {
    id: "gb-aarong-kurti",
    title: "Aarong Ethnic Kurti Bundle (Set of 3)",
    image:
      "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=600&q=80",
    category: "Fashion",
    originalPrice: "7500",
    groupPrice: "4999",
    cashbackPercent: "12",
    depositPercent: "20",
    minParticipants: 100,
    endsAt: new Date("2026-08-05T18:00:00.000Z"),
  },
  {
    id: "gb-coffee-box",
    title: "North End Coffee — Monthly Box (4 bags)",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80",
    category: "Food",
    originalPrice: "3800",
    groupPrice: "2600",
    cashbackPercent: "10",
    depositPercent: "25",
    minParticipants: 100,
    endsAt: new Date("2026-08-04T12:00:00.000Z"),
  },
  {
    id: "gb-cosrx-kit",
    title: "COSRX Skincare Starter Kit",
    image:
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80",
    category: "Beauty",
    originalPrice: "5200",
    groupPrice: "3200",
    cashbackPercent: "15",
    depositPercent: "20",
    minParticipants: 60,
    endsAt: new Date("2026-08-07T18:00:00.000Z"),
  },
] as const;

let seedPromise: Promise<void> | undefined;
export function ensureGroupBuySeeded(): Promise<void> {
  seedPromise ??= db
    .insert(groupBuyDealsTable)
    .values([...dealSeed])
    .onConflictDoNothing()
    .then(() => undefined);
  return seedPromise;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export const groupBuyOrderView = (row: typeof groupBuyOrdersTable.$inferSelect) => ({
  id: row.id,
  dealId: row.dealId,
  fullName: row.fullName,
  phone: row.phone,
  address: row.address,
  quantity: row.quantity,
  unitPrice: money(row.unitPrice),
  totalAmount: money(row.totalAmount),
  depositPaid: money(row.depositPaid),
  dueAmount: money(row.dueAmount),
  paymentMethod: row.paymentMethod,
  paymentRef: row.paymentRef,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
});

export function campaignView(
  deal: GroupBuyDealRow,
  progress: { joined: number; deposits: number },
) {
  return {
    id: deal.id,
    storeId: deal.storeId,
    approvalStatus: deal.approvalStatus,
    title: deal.title,
    image: deal.image,
    category: deal.category,
    originalPrice: money(deal.originalPrice),
    groupPrice: money(deal.groupPrice),
    cashbackPercent: money(deal.cashbackPercent),
    depositPercent: money(deal.depositPercent),
    minParticipants: deal.minParticipants,
    joinedCount: progress.joined,
    depositCollected: progress.deposits,
    endsAt: deal.endsAt.toISOString(),
    status: deal.endsAt.getTime() < Date.now() ? "closed" : deal.status,
    createdAt: deal.createdAt.toISOString(),
  };
}

export async function campaignProgress(dealIds?: string[]) {
  const rows = await db
    .select({
      dealId: groupBuyOrdersTable.dealId,
      joined: sql<number>`coalesce(sum(${groupBuyOrdersTable.quantity}), 0)`.mapWith(Number),
      deposits: sql<number>`coalesce(sum(${groupBuyOrdersTable.depositPaid}), 0)`.mapWith(Number),
    })
    .from(groupBuyOrdersTable)
    .where(eq(groupBuyOrdersTable.status, "reserved"))
    .groupBy(groupBuyOrdersTable.dealId);
  const map = new Map(rows.map((r) => [r.dealId, r]));
  return (dealId: string) => map.get(dealId) ?? { dealId, joined: 0, deposits: 0 };
}

// ---------------------------------------------------------------------------
// Join flow
// ---------------------------------------------------------------------------

export type JoinOutcome =
  | { kind: "ok"; order: typeof groupBuyOrdersTable.$inferSelect }
  | { kind: "not_found" }
  | { kind: "closed" }
  | { kind: "already_joined" }
  | { kind: "payment_failed" };

/** Sentinel used to roll the join transaction back on a failed charge. */
class DepositPaymentFailedError extends Error {}

/** Sentinel: the unique (deal, customer) index rejected a duplicate join. */
class AlreadyJoinedError extends Error {}

/** True when the error (possibly wrapped by Drizzle) is a unique violation. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Join a group-buy deal. The entire flow — deal open/closed check, pending
 * reservation insert, deposit charge, and confirmation — runs inside a single
 * transaction holding a FOR UPDATE lock on the deal row, making the check and
 * insert atomic and serializing concurrent joins.
 */
export async function executeJoin(input: {
  dealId: string;
  customerId: string;
  fullName: string;
  phone: string;
  address: string;
  quantity: number;
  paymentMethod: "bkash" | "nagad" | "card";
}): Promise<JoinOutcome> {
  try {
    return await db.transaction(async (tx): Promise<JoinOutcome> => {
      const [deal] = await tx
        .select()
        .from(groupBuyDealsTable)
        .where(eq(groupBuyDealsTable.id, input.dealId))
        .for("update")
        .limit(1);
      if (!deal || deal.approvalStatus !== "approved") return { kind: "not_found" };
      if (deal.status !== "open" || deal.endsAt.getTime() < Date.now()) {
        return { kind: "closed" };
      }

      const unitPrice = money(deal.groupPrice);
      const totalAmount = unitPrice * input.quantity;
      const depositPaid = Math.round((totalAmount * money(deal.depositPercent)) / 100);
      const dueAmount = totalAmount - depositPaid;
      // Snapshot the cashback entitlement at reservation time so settlement uses
      // the rate the participant agreed to, not the rate at processing time.
      const cashbackAmountEntitled = Math.round(
        (totalAmount * money(deal.cashbackPercent)) / 100 / 2,
      );

      let pendingOrder: typeof groupBuyOrdersTable.$inferSelect;
      try {
        const [inserted] = await tx
          .insert(groupBuyOrdersTable)
          .values({
            id: `gborder_${crypto.randomUUID()}`,
            dealId: deal.id,
            customerId: input.customerId,
            fullName: input.fullName,
            phone: input.phone,
            address: input.address,
            quantity: input.quantity,
            unitPrice: String(unitPrice),
            totalAmount: String(totalAmount),
            depositPaid: String(depositPaid),
            dueAmount: String(dueAmount),
            cashbackAmountEntitled: String(cashbackAmountEntitled),
            paymentMethod: input.paymentMethod,
            paymentRef: null,
            status: "pending_payment",
          })
          .returning();
        pendingOrder = inserted;
      } catch (error: unknown) {
        if (isUniqueViolation(error)) throw new AlreadyJoinedError();
        throw error;
      }

      let paymentRef: string;
      try {
        const charge = await paymentService.charge({
          customerId: input.customerId,
          amount: depositPaid,
          method: input.paymentMethod,
          purpose: `group-buy-deposit:${deal.id}`,
        });
        paymentRef = charge.reference;
      } catch {
        throw new DepositPaymentFailedError();
      }

      const [order] = await tx
        .update(groupBuyOrdersTable)
        .set({ paymentRef, status: "reserved" })
        .where(
          and(
            eq(groupBuyOrdersTable.id, pendingOrder.id),
            eq(groupBuyOrdersTable.status, "pending_payment"),
          ),
        )
        .returning();
      if (!order) throw new Error("Pending group-buy reservation disappeared before confirmation");
      return { kind: "ok", order };
    });
  } catch (error: unknown) {
    if (error instanceof DepositPaymentFailedError) return { kind: "payment_failed" };
    if (error instanceof AlreadyJoinedError) return { kind: "already_joined" };
    throw error;
  }
}
