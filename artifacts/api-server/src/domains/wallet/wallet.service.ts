/**
 * Wallet domain — balance management, transactions, withdrawals.
 *
 * Owns: walletSnapshotsTable, walletTransactionsTable, withdrawalRequestsTable
 * Used by: orders domain (for posting cashback transactions inside checkout /
 *          cancel / cashback-release transactions).
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  db,
  walletTransactionsTable,
  walletSnapshotsTable,
  withdrawalRequestsTable,
} from "@workspace/db";
import { money } from "../../lib/money";

// Infer the Drizzle transaction type without depending on a concrete class.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

// ---------------------------------------------------------------------------
// Internal helper — used by this module and by the orders domain
// ---------------------------------------------------------------------------

/**
 * Ensure a wallet snapshot row exists for the user WITHIN a transaction.
 * Returns the row (existing or newly inserted).
 */
export async function ensureWalletSnapshot(tx: Tx, userId: string) {
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

  const [snapshot] = await tx
    .select()
    .from(walletSnapshotsTable)
    .where(eq(walletSnapshotsTable.id, userId))
    .limit(1);

  return snapshot!;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export function walletTransactionView(tx: typeof walletTransactionsTable.$inferSelect) {
  return {
    id: tx.id,
    type: tx.type,
    amount: money(tx.amount),
    description: tx.description,
    referenceId: tx.referenceId ?? null,
    referenceType: tx.referenceType ?? null,
    createdAt: tx.createdAt.toISOString(),
  };
}

export function withdrawalView(w: typeof withdrawalRequestsTable.$inferSelect) {
  return {
    id: w.id,
    amount: money(w.amount),
    status: w.status,
    bankName: w.bankName,
    accountNumber: w.accountNumber,
    notes: w.notes,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listWalletTransactions(userId: string, limit = 20) {
  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.userId, userId))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(limit);

  return transactions.map(walletTransactionView);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Request a withdrawal from the user's available cashback balance.
 * Atomically deducts the amount and creates the withdrawal request row.
 */
export async function requestWithdrawal(
  userId: string,
  amount: number,
  bankName: string,
  accountNumber: string,
  notes = "",
) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const result = await db.transaction(async (tx) => {
    const snapshot = await ensureWalletSnapshot(tx, userId);
    const available = money(snapshot.availableCashback);

    if (amount > available) {
      throw new Error(`Insufficient available balance. Available: ${available}`);
    }

    // Atomic conditional deduction — WHERE predicate prevents race-condition
    // over-withdrawal between concurrent requests.
    const deducted = await tx
      .update(walletSnapshotsTable)
      .set({
        availableCashback: sql`${walletSnapshotsTable.availableCashback} - ${amount}`,
        balance: sql`${walletSnapshotsTable.balance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(walletSnapshotsTable.id, userId),
          sql`${walletSnapshotsTable.availableCashback} >= ${amount}`,
        ),
      )
      .returning();

    if (deducted.length === 0) {
      throw new Error("Insufficient available balance (concurrent withdrawal detected)");
    }

    const withdrawalId = nanoid();

    const [withdrawal] = await tx
      .insert(withdrawalRequestsTable)
      .values({
        id: withdrawalId,
        userId,
        amount: String(amount),
        status: "pending",
        bankName,
        accountNumber,
        notes,
      })
      .returning();

    await tx.insert(walletTransactionsTable).values({
      id: nanoid(),
      userId,
      type: "withdrawal_requested",
      amount: String(-amount),
      description: `Withdrawal requested — ${bankName} ${accountNumber}`,
      referenceId: withdrawalId,
      referenceType: "withdrawal",
    });

    return withdrawal!;
  });

  return { withdrawal: withdrawalView(result) };
}
