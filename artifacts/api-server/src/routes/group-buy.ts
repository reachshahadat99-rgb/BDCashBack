import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  CreateMerchantGroupBuyBody,
  CreateMerchantGroupBuyResponse,
  JoinGroupBuyDealBody,
  JoinGroupBuyDealParams,
  JoinGroupBuyDealResponse,
  ListGroupBuyDealsResponse,
  ListMerchantGroupBuysResponse,
} from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";
import {
  db,
  groupBuyDealsTable,
  groupBuyOrdersTable,
  type GroupBuyDeal as GroupBuyDealRow,
} from "@workspace/db";
import { getMerchantStore } from "../lib/merchant";
import { recordedPaymentService as paymentService } from "../lib/payments";

const router: IRouter = Router();
const money = (value: string | number | null | undefined) => Number(value ?? 0);

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
function ensureSeeded(): Promise<void> {
  seedPromise ??= db
    .insert(groupBuyDealsTable)
    .values([...dealSeed])
    .onConflictDoNothing()
    .then(() => undefined);
  return seedPromise;
}

const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.userId = userId;
  next();
};

const orderView = (row: typeof groupBuyOrdersTable.$inferSelect) => ({
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

router.get("/group-buys", async (req, res): Promise<void> => {
  await ensureSeeded();
  const userId = getAuth(req).userId;

  const deals = await db.select().from(groupBuyDealsTable);
  const counts = await db
    .select({
      dealId: groupBuyOrdersTable.dealId,
      joined: sql<number>`coalesce(sum(${groupBuyOrdersTable.quantity}), 0)`.mapWith(Number),
    })
    .from(groupBuyOrdersTable)
    .groupBy(groupBuyOrdersTable.dealId);
  const countByDeal = new Map(counts.map((c) => [c.dealId, c.joined]));

  const myOrders = userId
    ? await db
        .select()
        .from(groupBuyOrdersTable)
        .where(eq(groupBuyOrdersTable.customerId, userId))
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
        myOrder: mine ? orderView(mine) : null,
      };
    });

  res.json(ListGroupBuyDealsResponse.parse(view));
});

router.post("/group-buys/:id/join", requireAuth, async (req, res): Promise<void> => {
  await ensureSeeded();
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

  const [deal] = await db
    .select()
    .from(groupBuyDealsTable)
    .where(eq(groupBuyDealsTable.id, params.data.id))
    .limit(1);
  if (!deal || deal.approvalStatus !== "approved") {
    res.status(404).json({ error: "Group buy deal not found" });
    return;
  }
  if (deal.status !== "open" || deal.endsAt.getTime() < Date.now()) {
    res.status(409).json({ error: "This group buy has closed" });
    return;
  }

  const customerId = res.locals.userId as string;
  const unitPrice = money(deal.groupPrice);
  const totalAmount = unitPrice * quantity;
  const depositPaid = Math.round((totalAmount * money(deal.depositPercent)) / 100);
  const dueAmount = totalAmount - depositPaid;

  let paymentRef: string;
  try {
    const charge = await paymentService.charge({
      customerId,
      amount: depositPaid,
      method: paymentMethod,
      purpose: `group-buy-deposit:${deal.id}`,
    });
    paymentRef = charge.reference;
  } catch {
    res.status(402).json({ error: "Deposit payment failed. Please try again." });
    return;
  }

  try {
    const [order] = await db
      .insert(groupBuyOrdersTable)
      .values({
        id: `gborder_${crypto.randomUUID()}`,
        dealId: deal.id,
        customerId,
        fullName: fullName.trim(),
        phone: phoneDigits,
        address: address.trim(),
        quantity,
        unitPrice: String(unitPrice),
        totalAmount: String(totalAmount),
        depositPaid: String(depositPaid),
        dueAmount: String(dueAmount),
        paymentMethod,
        paymentRef,
        status: "reserved",
      })
      .returning();

    res.status(201).json(JoinGroupBuyDealResponse.parse(orderView(order)));
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      res.status(409).json({ error: "You have already joined this group buy" });
      return;
    }
    throw error;
  }
});

export async function campaignProgress(dealIds?: string[]) {
  const rows = await db
    .select({
      dealId: groupBuyOrdersTable.dealId,
      joined: sql<number>`coalesce(sum(${groupBuyOrdersTable.quantity}), 0)`.mapWith(Number),
      deposits: sql<number>`coalesce(sum(${groupBuyOrdersTable.depositPaid}), 0)`.mapWith(Number),
    })
    .from(groupBuyOrdersTable)
    .groupBy(groupBuyOrdersTable.dealId);
  const map = new Map(rows.map((r) => [r.dealId, r]));
  return (dealId: string) => map.get(dealId) ?? { dealId, joined: 0, deposits: 0 };
}

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

router.get("/merchant/group-buys", requireAuth, async (_req, res): Promise<void> => {
  await ensureSeeded();
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
