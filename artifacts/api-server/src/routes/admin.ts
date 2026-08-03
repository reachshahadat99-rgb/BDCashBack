import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  ActionAdminOrderBody,
  ActionAdminOrderParams,
  ActionAdminOrderResponse,
  ActionAdminWithdrawalBody,
  ActionAdminWithdrawalParams,
  ActionAdminWithdrawalResponse,
  ClaimAdminResponse,
  CreateAdminCouponBody,
  CreateAdminCouponResponse,
  CreateAdminFeeRuleBody,
  CreateAdminFeeRuleResponse,
  CreateAdminGiftCardBody,
  CreateAdminGiftCardBrandBody,
  CreateAdminGiftCardBrandResponse,
  CreateAdminGiftCardResponse,
  GetAdminMeResponse,
  ListAdminAuditLogsResponse,
  ListAdminCashbackQueueResponse,
  ListAdminCouponsResponse,
  ListAdminDealsResponse,
  ListAdminFeeRulesResponse,
  ListAdminGiftCardBrandsResponse,
  ListAdminGiftCardOrdersResponse,
  ListAdminGroupBuysResponse,
  ListAdminMerchantsResponse,
  ListAdminOrdersResponse,
  ListAdminWalletTransactionsResponse,
  ListAdminWithdrawalsResponse,
  ModerateAdminCouponBody,
  ModerateAdminCouponParams,
  ModerateAdminCouponResponse,
  ModerateAdminDealBody,
  ModerateAdminDealParams,
  ModerateAdminDealResponse,
  ModerateAdminGroupBuyBody,
  ModerateAdminGroupBuyParams,
  ModerateAdminGroupBuyResponse,
  UpdateAdminFeeRuleBody,
  UpdateAdminFeeRuleParams,
  UpdateAdminFeeRuleResponse,
  UpdateAdminGiftCardBody,
  UpdateAdminGiftCardBrandBody,
  UpdateAdminGiftCardBrandParams,
  UpdateAdminGiftCardBrandResponse,
  UpdateAdminGiftCardParams,
  UpdateAdminGiftCardResponse,
  UpdateAdminMerchantBody,
  UpdateAdminMerchantParams,
  UpdateAdminMerchantResponse,
} from "@workspace/api-zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  db,
  adminUsersTable,
  auditLogsTable,
  couponsTable,
  customerOrdersTable,
  giftCardBrandsTable,
  giftCardOrdersTable,
  giftCardsTable,
  groupBuyDealsTable,
  marketplaceCategoriesTable,
  merchantProductsTable,
  merchantStoresTable,
  promoDealsTable,
  successFeeRulesTable,
  walletTransactionsTable,
  walletSnapshotsTable,
  withdrawalRequestsTable,
  type SuccessFeeRule,
} from "@workspace/db";
import { adminCount, isAdmin, requireAdmin } from "../lib/admin";
import { couponView, insertCoupon, listCouponsWithStore, validateCouponDates, validateCouponValues } from "./coupons";
import { listDealsWithStore, promoDealView } from "./promo-deals";
import { campaignProgress, campaignView } from "./group-buy";
import { brandView, ensureGiftCardsSeeded, giftCardOrderView, giftCardView } from "./gift-cards";

const router: IRouter = Router();
const money = (v: string | number | null | undefined) => Number(v ?? 0);

const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.userId = userId;
  next();
};

function feeRuleView(rule: SuccessFeeRule, categoryName: string) {
  return {
    id: rule.id,
    categoryId: rule.categoryId,
    categoryName,
    feePercent: money(rule.feePercent),
    customerSharePercent: money(rule.customerSharePercent),
    returnPeriodDays: rule.returnPeriodDays,
    active: rule.active,
  };
}

router.get("/admin/me", requireAuth, async (_req, res): Promise<void> => {
  const admin = await isAdmin(res.locals.userId as string);
  const count = await adminCount();
  res.json(GetAdminMeResponse.parse({ isAdmin: admin, canClaim: !admin && count === 0 }));
});

router.post("/admin/claim", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  if (await isAdmin(userId)) {
    res.status(201).json(ClaimAdminResponse.parse({ isAdmin: true, canClaim: false }));
    return;
  }
  // Atomic claim: the insert only succeeds while the table is empty, so
  // concurrent first-time claims cannot both create an admin seat.
  const claimed = await db.execute(
    sql`insert into admin_users (user_id, role)
        select ${userId}, 'admin'
        where not exists (select 1 from admin_users)
        returning user_id`,
  );
  if (claimed.rows.length === 0) {
    res.status(409).json({ error: "An admin already exists" });
    return;
  }
  res.status(201).json(ClaimAdminResponse.parse({ isAdmin: true, canClaim: false }));
});

router.get("/admin/merchants", requireAdmin, async (_req, res): Promise<void> => {
  const stores = await db.select().from(merchantStoresTable);
  const products = await db
    .select({ storeId: merchantProductsTable.storeId })
    .from(merchantProductsTable);
  const countByStore = new Map<string, number>();
  for (const p of products) {
    countByStore.set(p.storeId, (countByStore.get(p.storeId) ?? 0) + 1);
  }
  res.json(
    ListAdminMerchantsResponse.parse(
      stores
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((s) => ({
          id: s.id,
          ownerId: s.ownerId,
          name: s.name,
          slug: s.slug,
          status: s.status,
          productCount: countByStore.get(s.id) ?? 0,
          createdAt: s.createdAt.toISOString(),
        })),
    ),
  );
});

router.patch("/admin/merchants/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateAdminMerchantParams.safeParse(req.params);
  const parsed = UpdateAdminMerchantBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const [store] = await db
    .update(merchantStoresTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(merchantStoresTable.id, params.data.id))
    .returning();
  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return;
  }
  const products = await db
    .select({ storeId: merchantProductsTable.storeId })
    .from(merchantProductsTable)
    .where(eq(merchantProductsTable.storeId, store.id));
  res.json(
    UpdateAdminMerchantResponse.parse({
      id: store.id,
      ownerId: store.ownerId,
      name: store.name,
      slug: store.slug,
      status: store.status,
      productCount: products.length,
      createdAt: store.createdAt.toISOString(),
    }),
  );
});

router.get("/admin/coupons", requireAdmin, async (_req, res): Promise<void> => {
  res.json(ListAdminCouponsResponse.parse(await listCouponsWithStore()));
});

router.post("/admin/coupons", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAdminCouponBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid coupon" });
    return;
  }
  const dateError = validateCouponDates(
    new Date(parsed.data.startsAt),
    new Date(parsed.data.endsAt),
  );
  const valueError = validateCouponValues(parsed.data);
  if (dateError || valueError) {
    res.status(400).json({ error: dateError ?? valueError });
    return;
  }
  try {
    const coupon = await insertCoupon({
      scope: "global",
      store: null,
      createdBy: res.locals.userId as string,
      status: "approved",
      body: parsed.data,
    });
    res.status(201).json(CreateAdminCouponResponse.parse(couponView(coupon, null)));
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "This coupon code is already in use" });
      return;
    }
    throw error;
  }
});

router.patch("/admin/coupons/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = ModerateAdminCouponParams.safeParse(req.params);
  const parsed = ModerateAdminCouponBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const [updated] = await db
    .update(couponsTable)
    .set({ status: parsed.data.status })
    .where(eq(couponsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }
  let storeName: string | null = null;
  if (updated.storeId) {
    const [store] = await db
      .select({ name: merchantStoresTable.name })
      .from(merchantStoresTable)
      .where(eq(merchantStoresTable.id, updated.storeId))
      .limit(1);
    storeName = store?.name ?? null;
  }
  res.json(ModerateAdminCouponResponse.parse(couponView(updated, storeName)));
});

router.get("/admin/deals", requireAdmin, async (_req, res): Promise<void> => {
  res.json(ListAdminDealsResponse.parse(await listDealsWithStore()));
});

router.patch("/admin/deals/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = ModerateAdminDealParams.safeParse(req.params);
  const parsed = ModerateAdminDealBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid moderation" });
    return;
  }
  const [updated] = await db
    .update(promoDealsTable)
    .set({
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.featured !== undefined ? { featured: parsed.data.featured } : {}),
    })
    .where(eq(promoDealsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }
  const [store] = await db
    .select({ name: merchantStoresTable.name })
    .from(merchantStoresTable)
    .where(eq(merchantStoresTable.id, updated.storeId))
    .limit(1);
  res.json(ModerateAdminDealResponse.parse(promoDealView(updated, store?.name ?? "")));
});

router.get("/admin/group-buys", requireAdmin, async (_req, res): Promise<void> => {
  const deals = await db.select().from(groupBuyDealsTable);
  const progress = await campaignProgress();
  res.json(
    ListAdminGroupBuysResponse.parse(
      deals
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((d) => campaignView(d, progress(d.id))),
    ),
  );
});

router.patch("/admin/group-buys/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = ModerateAdminGroupBuyParams.safeParse(req.params);
  const parsed = ModerateAdminGroupBuyBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const [updated] = await db
    .update(groupBuyDealsTable)
    .set({ approvalStatus: parsed.data.status })
    .where(eq(groupBuyDealsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const progress = await campaignProgress();
  res.json(ModerateAdminGroupBuyResponse.parse(campaignView(updated, progress(updated.id))));
});

router.get("/admin/gift-card-brands", requireAdmin, async (_req, res): Promise<void> => {
  await ensureGiftCardsSeeded();
  const brands = await db.select().from(giftCardBrandsTable);
  const cards = await db.select().from(giftCardsTable);
  res.json(
    ListAdminGiftCardBrandsResponse.parse(
      brands
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((b) => brandView(b, cards.filter((c) => c.brandId === b.id))),
    ),
  );
});

router.post("/admin/gift-card-brands", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAdminGiftCardBrandBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: "A brand name is required" });
    return;
  }
  const [brand] = await db
    .insert(giftCardBrandsTable)
    .values({
      id: `gcb_${crypto.randomUUID()}`,
      name: parsed.data.name.trim(),
      logoUrl: parsed.data.logoUrl?.trim() ?? "",
      description: parsed.data.description?.trim() ?? "",
    })
    .returning();
  res.status(201).json(CreateAdminGiftCardBrandResponse.parse(brandView(brand, [])));
});

router.patch("/admin/gift-card-brands/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateAdminGiftCardBrandParams.safeParse(req.params);
  const parsed = UpdateAdminGiftCardBrandBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid update" });
    return;
  }
  const [brand] = await db
    .update(giftCardBrandsTable)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.logoUrl !== undefined ? { logoUrl: parsed.data.logoUrl.trim() } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description.trim() }
        : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    })
    .where(eq(giftCardBrandsTable.id, params.data.id))
    .returning();
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  const cards = await db
    .select()
    .from(giftCardsTable)
    .where(eq(giftCardsTable.brandId, brand.id));
  res.json(UpdateAdminGiftCardBrandResponse.parse(brandView(brand, cards)));
});

router.post("/admin/gift-cards", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAdminGiftCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid gift card" });
    return;
  }
  if (parsed.data.price > parsed.data.faceValue) {
    res.status(400).json({ error: "Price cannot exceed the face value" });
    return;
  }
  const [brand] = await db
    .select()
    .from(giftCardBrandsTable)
    .where(eq(giftCardBrandsTable.id, parsed.data.brandId))
    .limit(1);
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  const [card] = await db
    .insert(giftCardsTable)
    .values({
      id: `gc_${crypto.randomUUID()}`,
      brandId: brand.id,
      faceValue: String(parsed.data.faceValue),
      price: String(parsed.data.price),
      stock: Math.floor(parsed.data.stock),
    })
    .returning();
  res.status(201).json(CreateAdminGiftCardResponse.parse(giftCardView(card)));
});

router.patch("/admin/gift-cards/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateAdminGiftCardParams.safeParse(req.params);
  const parsed = UpdateAdminGiftCardBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid update" });
    return;
  }
  const [card] = await db
    .update(giftCardsTable)
    .set({
      ...(parsed.data.price !== undefined ? { price: String(parsed.data.price) } : {}),
      ...(parsed.data.stock !== undefined ? { stock: Math.floor(parsed.data.stock) } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    })
    .where(eq(giftCardsTable.id, params.data.id))
    .returning();
  if (!card) {
    res.status(404).json({ error: "Gift card not found" });
    return;
  }
  res.json(UpdateAdminGiftCardResponse.parse(giftCardView(card)));
});

router.get("/admin/gift-card-orders", requireAdmin, async (_req, res): Promise<void> => {
  const orders = await db.select().from(giftCardOrdersTable);
  res.json(
    ListAdminGiftCardOrdersResponse.parse(
      orders
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(giftCardOrderView),
    ),
  );
});

router.get("/admin/fee-rules", requireAdmin, async (_req, res): Promise<void> => {
  const rules = await db.select().from(successFeeRulesTable);
  const categories = await db.select().from(marketplaceCategoriesTable);
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  res.json(
    ListAdminFeeRulesResponse.parse(
      rules
        .sort((a, b) => a.categoryId.localeCompare(b.categoryId))
        .map((r) => feeRuleView(r, nameById.get(r.categoryId) ?? r.categoryId)),
    ),
  );
});

router.post("/admin/fee-rules", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAdminFeeRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid rule" });
    return;
  }
  const [category] = await db
    .select()
    .from(marketplaceCategoriesTable)
    .where(eq(marketplaceCategoriesTable.id, parsed.data.categoryId))
    .limit(1);
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  try {
    const [rule] = await db
      .insert(successFeeRulesTable)
      .values({
        id: `feerule_${crypto.randomUUID()}`,
        categoryId: category.id,
        feePercent: String(parsed.data.feePercent),
        customerSharePercent: String(parsed.data.customerSharePercent ?? 50),
        returnPeriodDays: Math.floor(parsed.data.returnPeriodDays ?? 7),
      })
      .returning();
    res.status(201).json(CreateAdminFeeRuleResponse.parse(feeRuleView(rule, category.name)));
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A rule already exists for this category" });
      return;
    }
    throw error;
  }
});

router.patch("/admin/fee-rules/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateAdminFeeRuleParams.safeParse(req.params);
  const parsed = UpdateAdminFeeRuleBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid update" });
    return;
  }
  const [rule] = await db
    .update(successFeeRulesTable)
    .set({
      ...(parsed.data.feePercent !== undefined
        ? { feePercent: String(parsed.data.feePercent) }
        : {}),
      ...(parsed.data.customerSharePercent !== undefined
        ? { customerSharePercent: String(parsed.data.customerSharePercent) }
        : {}),
      ...(parsed.data.returnPeriodDays !== undefined
        ? { returnPeriodDays: Math.floor(parsed.data.returnPeriodDays) }
        : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    })
    .where(eq(successFeeRulesTable.id, params.data.id))
    .returning();
  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  const [category] = await db
    .select()
    .from(marketplaceCategoriesTable)
    .where(eq(marketplaceCategoriesTable.id, rule.categoryId))
    .limit(1);
  res.json(UpdateAdminFeeRuleResponse.parse(feeRuleView(rule, category?.name ?? rule.categoryId)));
});

// ---------------------------------------------------------------------------
// Shared audit-log helper
// ---------------------------------------------------------------------------
async function writeAuditLog(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: object = {},
) {
  await db.insert(auditLogsTable).values({
    id: nanoid(),
    adminUserId,
    action,
    targetType,
    targetId,
    details: JSON.stringify(details),
  });
}

const money2 = (v: string | number | null | undefined) => Number(v ?? 0);

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------

router.get("/admin/withdrawals", requireAdmin, async (req, res): Promise<void> => {
  const statusFilter = typeof req.query["status"] === "string" ? req.query["status"] : undefined;
  const rows = statusFilter
    ? await db
        .select()
        .from(withdrawalRequestsTable)
        .where(eq(withdrawalRequestsTable.status, statusFilter))
        .orderBy(desc(withdrawalRequestsTable.createdAt))
    : await db
        .select()
        .from(withdrawalRequestsTable)
        .orderBy(desc(withdrawalRequestsTable.createdAt));

  res.json(
    ListAdminWithdrawalsResponse.parse(
      rows.map((w) => ({
        id: w.id,
        userId: w.userId,
        amount: money2(w.amount),
        status: w.status,
        bankName: w.bankName,
        accountNumber: w.accountNumber,
        notes: w.notes,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    ),
  );
});

router.patch("/admin/withdrawals/:id/action", requireAdmin, async (req, res): Promise<void> => {
  const params = ActionAdminWithdrawalParams.safeParse(req.params);
  const parsed = ActionAdminWithdrawalBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

  const actionToStatus: Record<string, string> = {
    approve: "processing",
    reject: "failed",
    process: "completed",
  };
  const newStatus = actionToStatus[parsed.data.action];
  if (!newStatus) {
    res.status(400).json({ error: "Unknown action" });
    return;
  }

  const [updated] = await db
    .update(withdrawalRequestsTable)
    .set({
      status: newStatus,
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(withdrawalRequestsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  await writeAuditLog(
    res.locals.userId as string,
    `withdrawal.${parsed.data.action}`,
    "withdrawal",
    updated.id,
    { newStatus },
  );

  res.json(
    ActionAdminWithdrawalResponse.parse({
      id: updated.id,
      userId: updated.userId,
      amount: money2(updated.amount),
      status: updated.status,
      bankName: updated.bankName,
      accountNumber: updated.accountNumber,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }),
  );
});

// ---------------------------------------------------------------------------
// Wallet transactions (platform-wide view)
// ---------------------------------------------------------------------------

router.get("/admin/wallet-transactions", requireAdmin, async (req, res): Promise<void> => {
  const typeFilter =
    typeof req.query["type"] === "string" ? req.query["type"] : undefined;
  const limit = Math.min(
    Math.max(1, Number(req.query["limit"] ?? 100)),
    500,
  );

  const rows = typeFilter
    ? await db
        .select()
        .from(walletTransactionsTable)
        .where(eq(walletTransactionsTable.type, typeFilter))
        .orderBy(desc(walletTransactionsTable.createdAt))
        .limit(limit)
    : await db
        .select()
        .from(walletTransactionsTable)
        .orderBy(desc(walletTransactionsTable.createdAt))
        .limit(limit);

  res.json(
    ListAdminWalletTransactionsResponse.parse(
      rows.map((t) => ({
        id: t.id,
        userId: t.userId,
        type: t.type,
        amount: money2(t.amount),
        description: t.description,
        referenceId: t.referenceId ?? null,
        referenceType: t.referenceType ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    ),
  );
});

// ---------------------------------------------------------------------------
// Orders (platform-wide view)
// ---------------------------------------------------------------------------

router.get("/admin/orders", requireAdmin, async (req, res): Promise<void> => {
  const statusFilter =
    typeof req.query["status"] === "string" ? req.query["status"] : undefined;
  const limit = Math.min(Math.max(1, Number(req.query["limit"] ?? 100)), 500);

  const rows = statusFilter
    ? await db
        .select()
        .from(customerOrdersTable)
        .where(eq(customerOrdersTable.status, statusFilter))
        .orderBy(desc(customerOrdersTable.createdAt))
        .limit(limit)
    : await db
        .select()
        .from(customerOrdersTable)
        .orderBy(desc(customerOrdersTable.createdAt))
        .limit(limit);

  res.json(
    ListAdminOrdersResponse.parse(
      rows.map((o) => ({
        id: o.id,
        userId: o.userId,
        status: o.status,
        total: money2(o.total),
        cashbackAmount: money2(o.cashbackAmount),
        discountAmount: money2(o.discountAmount),
        couponCode: o.couponCode ?? null,
        itemsCount: o.itemsCount,
        deliveredAt: o.deliveredAt?.toISOString() ?? null,
        completedAt: o.completedAt?.toISOString() ?? null,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    ),
  );
});

router.patch("/admin/orders/:id/action", requireAdmin, async (req, res): Promise<void> => {
  const params = ActionAdminOrderParams.safeParse(req.params);
  const parsed = ActionAdminOrderBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

  const [existing] = await db
    .select()
    .from(customerOrdersTable)
    .where(eq(customerOrdersTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  let newStatus: string;
  if (parsed.data.action === "cancel") {
    if (!["paid", "processing"].includes(existing.status)) {
      res.status(400).json({ error: "Only paid or processing orders can be cancelled" });
      return;
    }
    newStatus = "cancelled";
  } else if (parsed.data.action === "force_complete") {
    if (existing.status === "completed") {
      res.status(400).json({ error: "Order is already completed" });
      return;
    }
    newStatus = "completed";
  } else {
    res.status(400).json({ error: "Unknown action" });
    return;
  }

  const [updated] = await db
    .update(customerOrdersTable)
    .set({
      status: newStatus,
      ...(newStatus === "completed" ? { completedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(customerOrdersTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  await writeAuditLog(
    res.locals.userId as string,
    `order.${parsed.data.action}`,
    "order",
    updated.id,
    { reason: parsed.data.reason ?? "", prevStatus: existing.status, newStatus },
  );

  res.json(
    ActionAdminOrderResponse.parse({
      id: updated.id,
      userId: updated.userId,
      status: updated.status,
      total: money2(updated.total),
      cashbackAmount: money2(updated.cashbackAmount),
      discountAmount: money2(updated.discountAmount),
      couponCode: updated.couponCode ?? null,
      itemsCount: updated.itemsCount,
      deliveredAt: updated.deliveredAt?.toISOString() ?? null,
      completedAt: updated.completedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }),
  );
});

// ---------------------------------------------------------------------------
// Cashback queue (pending cashback platform-wide)
// ---------------------------------------------------------------------------

router.get("/admin/cashback-queue", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.type, "cashback_pending"))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(200);

  res.json(
    ListAdminCashbackQueueResponse.parse(
      rows.map((t) => ({
        id: t.id,
        userId: t.userId,
        orderId: t.referenceType === "order" ? t.referenceId : null,
        amount: money2(t.amount),
        description: t.description,
        referenceType: t.referenceType ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    ),
  );
});

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

router.get("/admin/audit-logs", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Math.max(1, Number(req.query["limit"] ?? 100)), 500);

  const rows = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit);

  res.json(
    ListAdminAuditLogsResponse.parse(
      rows.map((l) => ({
        id: l.id,
        adminUserId: l.adminUserId,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        details: l.details,
        createdAt: l.createdAt.toISOString(),
      })),
    ),
  );
});

export default router;
