import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import {
  GetWalletSummaryResponse,
  ListWalletTransactionsResponse,
  ListWalletTransactionsQueryParams,
  RequestWithdrawalBody,
  RequestWithdrawalResponse,
} from "@workspace/api-zod";
import { db, walletSnapshotsTable } from "@workspace/db";
import { listWalletTransactions, requestWithdrawal } from "../lib/orders";

const router: IRouter = Router();

const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.userId = userId;
  next();
};

// GET /wallet/summary
router.get("/wallet/summary", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;

  const [snapshot] = await db
    .select()
    .from(walletSnapshotsTable)
    .where(eq(walletSnapshotsTable.id, userId))
    .limit(1);

  res.json(
    GetWalletSummaryResponse.parse({
      balance: Number(snapshot?.balance ?? 0),
      pendingCashback: Number(snapshot?.pendingCashback ?? 0),
      availableCashback: Number(snapshot?.availableCashback ?? 0),
      rewardPoints: Number(snapshot?.rewardPoints ?? 0),
    }),
  );
});

// GET /wallet/transactions
router.get("/wallet/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const parsed = ListWalletTransactionsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;

  const transactions = await listWalletTransactions(userId, limit);
  res.json(ListWalletTransactionsResponse.parse(transactions));
});

// POST /wallet/withdraw
router.post("/wallet/withdraw", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const parsed = RequestWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, bankName, accountNumber, notes } = parsed.data;

  try {
    const result = await requestWithdrawal(userId, amount, bankName, accountNumber, notes ?? "");
    res.status(201).json(RequestWithdrawalResponse.parse(result.withdrawal));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Withdrawal request failed";
    res.status(400).json({ error: msg });
  }
});

export default router;
