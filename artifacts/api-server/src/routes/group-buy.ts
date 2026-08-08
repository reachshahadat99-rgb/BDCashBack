import { Router, type IRouter, type Request } from "express";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/auth";

/** Extract userId from Bearer token without requiring auth (returns null if absent/invalid). */
function optionalUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return null;
    const payload = jwt.verify(header.slice(7), secret) as { userId: string };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}
import { money } from "../lib/money";
import {
  CreateMerchantGroupBuyBody,
  CreateMerchantGroupBuyResponse,
  JoinGroupBuyDealBody,
  JoinGroupBuyDealParams,
  JoinGroupBuyDealResponse,
  ListGroupBuyDealsResponse,
  ListMerchantGroupBuysResponse,
} from "@workspace/api-zod";
import { and, eq, sql } from "drizzle-orm";
import { db, groupBuyDealsTable, groupBuyOrdersTable } from "@workspace/db";
import { getMerchantStore } from "../lib/merchant";
import {
  ensureGroupBuySeeded,
  groupBuyOrderView,
  executeJoin,
  campaignProgress,
  campaignView,
} from "../domains/group-buy/group-buy.service";

const router: IRouter = Router();

router.get("/group-buys", async (req, res): Promise<void> => {
  await ensureGroupBuySeeded();
  const userId = optionalUserId(req);

  const deals = await db.select().from(groupBuyDealsTable);
  const counts = await db
    .select({
      dealId: groupBuyOrdersTable.dealId,
      joined: sql<number>`coalesce(sum(${groupBuyOrdersTable.quantity}), 0)`.mapWith(Number),
    })
    .from(groupBuyOrdersTable)
    .where(eq(groupBuyOrdersTable.status, "reserved"))
    .groupBy(groupBuyOrdersTable.dealId);
  const countByDeal = new Map(counts.map((c) => [c.dealId, c.joined]));

  const myOrders = userId
    ? await db
        .select()
        .from(groupBuyOrdersTable)
        .where(
          and(
            eq(groupBuyOrdersTable.customerId, userId),
            eq(groupBuyOrdersTable.status, "reserved"),
          ),
        )
    : [];
  const myOrderByDeal = new Map(myOrders.map((o) => [o.dealId, o]));

  const view = deals
    .filter((deal) => deal.approvalStatus === "approved")
    .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime())
    .map((deal) => {
      const mine = myOrderByDeal.get(deal.id);
      return {
        id: deal.id,
        title: deal.title,
        image: deal.image,
        category: deal.category,
        originalPrice: money(deal.originalPrice),
        groupPrice: money(deal.groupPrice),
        cashbackPercent: money(deal.cashbackPercent),
        depositPercent: money(deal.depositPercent),
        minParticipants: deal.minParticipants,
        joinedCount: countByDeal.get(deal.id) ?? 0,
        endsAt: deal.endsAt.toISOString(),
        status: deal.endsAt.getTime() < Date.now() ? "closed" : deal.status,
        myOrder: mine ? groupBuyOrderView(mine) : null,
      };
    });

  res.json(ListGroupBuyDealsResponse.parse(view));
});

router.post("/group-buys/:id/join", requireAuth, async (req, res): Promise<void> => {
  await ensureGroupBuySeeded();
  const params = JoinGroupBuyDealParams.safeParse(req.params);
  const parsed = JoinGroupBuyDealBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid order form" });
    return;
  }

  const { fullName, phone, address, quantity, paymentMethod } = parsed.data;
  if (!fullName.trim()) {
    res.status(400).json({ error: "Your full name is required" });
    return;
  }
  const phoneDigits = phone.replace(/[^0-9+]/g, "");
  if (!/^(\+?88)?01[3-9]\d{8}$/.test(phoneDigits)) {
    res.status(400).json({ error: "Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX)" });
    return;
  }
  if (address.trim().length < 10) {
    res.status(400).json({ error: "Enter a complete delivery address (at least 10 characters)" });
    return;
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
    res.status(400).json({ error: "Quantity must be between 1 and 5" });
    return;
  }

  const customerId = res.locals.userId as string;

  const result = await executeJoin({
    dealId: params.data.id,
    customerId,
    fullName: fullName.trim(),
    phone: phoneDigits,
    address: address.trim(),
    quantity,
    paymentMethod,
  });

  switch (result.kind) {
    case "not_found":
      res.status(404).json({ error: "Group buy deal not found" });
      return;
    case "closed":
      res.status(409).json({ error: "This group buy has closed" });
      return;
    case "already_joined":
      res.status(409).json({ error: "You have already joined this group buy" });
      return;
    case "payment_failed":
      res.status(402).json({ error: "Deposit payment failed. Please try again." });
      return;
    case "ok":
      res.status(201).json(JoinGroupBuyDealResponse.parse(groupBuyOrderView(result.order)));
      return;
  }
});

router.get("/merchant/group-buys", requireAuth, async (_req, res): Promise<void> => {
  await ensureGroupBuySeeded();
  const store = await getMerchantStore(res.locals.userId as string);
  if (!store) {
    res.json(ListMerchantGroupBuysResponse.parse([]));
    return;
  }
  const deals = await db
    .select()
    .from(groupBuyDealsTable)
    .where(eq(groupBuyDealsTable.storeId, store.id));
  const progress = await campaignProgress();
  res.json(
    ListMerchantGroupBuysResponse.parse(
      deals
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((d) => campaignView(d, progress(d.id))),
    ),
  );
});

router.post("/merchant/group-buys", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMerchantGroupBuyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid campaign" });
    return;
  }
  const endsAt = new Date(parsed.data.endsAt);
  if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
    res.status(400).json({ error: "Campaign end date must be in the future" });
    return;
  }
  if (parsed.data.groupPrice >= parsed.data.originalPrice) {
    res.status(400).json({ error: "Group price must be below the original price" });
    return;
  }
  const store = await getMerchantStore(res.locals.userId as string);
  if (!store) {
    res.status(404).json({ error: "Create your store before launching campaigns" });
    return;
  }

  const [deal] = await db
    .insert(groupBuyDealsTable)
    .values({
      id: `gbc_${crypto.randomUUID()}`,
      storeId: store.id,
      approvalStatus: "pending",
      title: parsed.data.title.trim(),
      image:
        parsed.data.image?.trim() ||
        "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80",
      category: parsed.data.category.trim(),
      originalPrice: String(parsed.data.originalPrice),
      groupPrice: String(parsed.data.groupPrice),
      cashbackPercent: String(parsed.data.cashbackPercent),
      depositPercent: String(parsed.data.depositPercent),
      minParticipants: Math.floor(parsed.data.minParticipants),
      endsAt,
      status: "open",
    })
    .returning();

  res
    .status(201)
    .json(CreateMerchantGroupBuyResponse.parse(campaignView(deal, { joined: 0, deposits: 0 })));
});

export default router;
