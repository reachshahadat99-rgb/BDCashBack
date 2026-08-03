/**
 * Concurrency/behavior test for the group-buy join flow.
 * Run: pnpm --filter @workspace/api-server exec tsx src/scripts/test-group-buy-join.ts
 */
import { and, eq } from "drizzle-orm";
import { db, groupBuyDealsTable, groupBuyOrdersTable } from "@workspace/db";
import { executeJoin } from "../routes/group-buy";

const DEAL_ID = "gbtest_concurrency";
const CUSTOMER = "user_test_concurrency";

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`PASS ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name}`, extra ?? "");
  }
}

async function cleanup() {
  await db.delete(groupBuyOrdersTable).where(eq(groupBuyOrdersTable.dealId, DEAL_ID));
  await db.delete(groupBuyDealsTable).where(eq(groupBuyDealsTable.id, DEAL_ID));
}

async function main() {
  await cleanup();
  await db.insert(groupBuyDealsTable).values({
    id: DEAL_ID,
    title: "Test deal",
    image: "https://example.com/x.png",
    category: "Test",
    originalPrice: "1000",
    groupPrice: "800",
    cashbackPercent: "5",
    depositPercent: "20",
    minParticipants: 10,
    endsAt: new Date(Date.now() + 60 * 60 * 1000),
    status: "open",
  });

  const joinInput = (customerId: string) => ({
    dealId: DEAL_ID,
    customerId,
    fullName: "Test User",
    phone: "01712345678",
    address: "House 1, Road 2, Dhaka",
    quantity: 1,
    paymentMethod: "bkash" as const,
  });

  // 1) Two simultaneous joins by the SAME user: exactly one succeeds,
  // and there is never a paid charge without a reserved order.
  const [a, b] = await Promise.all([
    executeJoin(joinInput(CUSTOMER)),
    executeJoin(joinInput(CUSTOMER)),
  ]);
  const kinds = [a.kind, b.kind].sort();
  check("same-user concurrent joins → one ok + one already_joined", 
    kinds.join(",") === "already_joined,ok", kinds);

  const rows = await db
    .select()
    .from(groupBuyOrdersTable)
    .where(and(eq(groupBuyOrdersTable.dealId, DEAL_ID), eq(groupBuyOrdersTable.customerId, CUSTOMER)));
  check("exactly one order row exists", rows.length === 1, rows.length);
  check("the row is reserved with a payment ref", 
    rows[0]?.status === "reserved" && !!rows[0]?.paymentRef, rows[0]);

  // 2) No pending_payment rows ever persist.
  const pending = await db
    .select()
    .from(groupBuyOrdersTable)
    .where(and(eq(groupBuyOrdersTable.dealId, DEAL_ID), eq(groupBuyOrdersTable.status, "pending_payment")));
  check("no lingering pending_payment rows", pending.length === 0, pending.length);

  // 3) Rejoin after success → already_joined, no double charge.
  const again = await executeJoin(joinInput(CUSTOMER));
  check("rejoin returns already_joined", again.kind === "already_joined", again.kind);

  // 4) Closed deal → closed, no row inserted.
  await db
    .update(groupBuyDealsTable)
    .set({ status: "closed" })
    .where(eq(groupBuyDealsTable.id, DEAL_ID));
  const closed = await executeJoin(joinInput("user_other"));
  check("closed deal rejects join", closed.kind === "closed", closed.kind);
  await db.update(groupBuyDealsTable).set({ status: "open" }).where(eq(groupBuyDealsTable.id, DEAL_ID));

  // 5) Failed charge (zero deposit → charge throws) rolls the pending row back.
  await db
    .update(groupBuyDealsTable)
    .set({ depositPercent: "0" })
    .where(eq(groupBuyDealsTable.id, DEAL_ID));
  const failed = await executeJoin(joinInput("user_payment_fail"));
  check("failed charge → payment_failed", failed.kind === "payment_failed", failed.kind);
  const failedRows = await db
    .select()
    .from(groupBuyOrdersTable)
    .where(and(eq(groupBuyOrdersTable.dealId, DEAL_ID), eq(groupBuyOrdersTable.customerId, "user_payment_fail")));
  check("failed charge leaves no order row", failedRows.length === 0, failedRows.length);

  await cleanup();
  if (failures > 0) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("All checks passed");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
