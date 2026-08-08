/**
 * Admin Merchant-Parity Routes — /admin/stores/:storeId/...
 *
 * Allows admins to manage any merchant's store (products, orders, summary)
 * without logging in as the merchant. Every mutation writes an audit_log
 * entry attributed to the admin, NOT the merchant.
 *
 * These routes do NOT use session-swapping. The admin acts with their own
 * credentials; the audit trail clearly records which admin touched which store.
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql, sum, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  db,
  auditLogsTable,
  marketplaceCategoriesTable,
  merchantOrdersTable,
  merchantProductsTable,
  merchantStoresTable,
  customerOrdersTable,
  customerOrderItemsTable,
  couponsTable,
  promoDealsTable,
  groupBuyDealsTable,
} from "@workspace/db";
import { requireAdmin } from "../middleware/auth";
import {
  merchantProductView,
  merchantOrderView,
  slugify,
  storeView,
} from "../lib/merchant";
import { money } from "../lib/money";
import { insertCoupon, couponView, listCouponsWithStore } from "../domains/coupons/coupon.service";
import { promoDealView, listDealsWithStore } from "../domains/promo-deals/promo-deal.service";
import { campaignView, campaignProgress } from "../domains/group-buy/group-buy.service";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helper: resolve + validate storeId
// ---------------------------------------------------------------------------
async function resolveStore(storeId: string) {
  const [store] = await db
    .select()
    .from(merchantStoresTable)
    .where(eq(merchantStoresTable.id, storeId))
    .limit(1);
  return store;
}

async function writeAdminAudit(
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

// ---------------------------------------------------------------------------
// Store summary
// ---------------------------------------------------------------------------
router.get("/admin/stores/:storeId/summary", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const [productCount] = await db
    .select({ n: count() })
    .from(merchantProductsTable)
    .where(eq(merchantProductsTable.storeId, store.id));

  const [revenueRow] = await db
    .select({
      totalRevenue: sum(merchantOrdersTable.total),
      totalCashback: sum(merchantOrdersTable.cashback),
      orderCount: count(),
    })
    .from(merchantOrdersTable)
    .where(eq(merchantOrdersTable.storeId, store.id));

  const recentOrders = await db
    .select()
    .from(merchantOrdersTable)
    .where(eq(merchantOrdersTable.storeId, store.id))
    .orderBy(desc(merchantOrdersTable.createdAt))
    .limit(5);

  res.json({
    store: storeView(store),
    productCount: Number(productCount?.n ?? 0),
    totalRevenue: money(revenueRow?.totalRevenue ?? 0),
    totalCashback: money(revenueRow?.totalCashback ?? 0),
    orderCount: Number(revenueRow?.orderCount ?? 0),
    recentOrders: recentOrders.map(merchantOrderView),
  });
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
router.get("/admin/stores/:storeId/products", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const rows = await db
    .select({ product: merchantProductsTable, categoryName: marketplaceCategoriesTable.name })
    .from(merchantProductsTable)
    .innerJoin(marketplaceCategoriesTable, eq(merchantProductsTable.categoryId, marketplaceCategoriesTable.id))
    .where(eq(merchantProductsTable.storeId, store.id))
    .orderBy(desc(merchantProductsTable.createdAt));

  res.json(rows.map(({ product, categoryName }) => merchantProductView(product, categoryName)));
});

router.post("/admin/stores/:storeId/products", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const { categoryId, name, description, brand, price, originalPrice, cashbackPercent, imageUrl, stock } = req.body;
  if (!categoryId || !name?.trim() || !brand?.trim() || !price || !originalPrice) {
    res.status(400).json({ error: "categoryId, name, brand, price and originalPrice are required" });
    return;
  }

  const [category] = await db
    .select()
    .from(marketplaceCategoriesTable)
    .where(eq(marketplaceCategoriesTable.id, categoryId))
    .limit(1);
  if (!category) { res.status(404).json({ error: "Category not found" }); return; }

  const [product] = await db
    .insert(merchantProductsTable)
    .values({
      id: `mp_${crypto.randomUUID()}`,
      storeId: store.id,
      categoryId: category.id,
      name: name.trim(),
      description: description?.trim() ?? "",
      brand: brand.trim(),
      price: String(Number(price)),
      originalPrice: String(Number(originalPrice)),
      cashbackPercent: String(Math.max(0, Math.min(100, Number(cashbackPercent ?? 0)))),
      imageUrl: imageUrl?.trim() ?? "",
      stock: Math.max(0, Math.floor(Number(stock ?? 0))),
    })
    .returning();

  await writeAdminAudit(res.locals.userId as string, "store.product.create", "merchant_product", product.id, {
    storeId: store.id, storeName: store.name, productName: product.name,
  });

  res.status(201).json(merchantProductView(product, category.name));
});

router.patch("/admin/stores/:storeId/products/:productId", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const [existing] = await db
    .select()
    .from(merchantProductsTable)
    .where(and(eq(merchantProductsTable.id, req.params.productId), eq(merchantProductsTable.storeId, store.id)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Product not found in this store" }); return; }

  const { name, description, brand, price, originalPrice, cashbackPercent, imageUrl, stock, available, status } = req.body;
  const patch: Partial<typeof merchantProductsTable.$inferInsert> = { updatedAt: new Date() };
  if (name !== undefined) patch.name = name.trim();
  if (description !== undefined) patch.description = description.trim();
  if (brand !== undefined) patch.brand = brand.trim();
  if (price !== undefined) patch.price = String(Number(price));
  if (originalPrice !== undefined) patch.originalPrice = String(Number(originalPrice));
  if (cashbackPercent !== undefined) patch.cashbackPercent = String(Math.max(0, Math.min(100, Number(cashbackPercent))));
  if (imageUrl !== undefined) patch.imageUrl = imageUrl.trim();
  if (stock !== undefined) patch.stock = Math.max(0, Math.floor(Number(stock)));
  if (typeof available === "boolean") patch.available = available;
  if (status !== undefined) patch.status = status;

  const [updated] = await db
    .update(merchantProductsTable)
    .set(patch)
    .where(eq(merchantProductsTable.id, existing.id))
    .returning();

  const [cat] = await db.select().from(marketplaceCategoriesTable).where(eq(marketplaceCategoriesTable.id, updated.categoryId)).limit(1);

  await writeAdminAudit(res.locals.userId as string, "store.product.update", "merchant_product", updated.id, {
    storeId: store.id, storeName: store.name, changes: Object.keys(patch),
  });

  res.json(merchantProductView(updated, cat?.name ?? updated.categoryId));
});

router.delete("/admin/stores/:storeId/products/:productId", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const [existing] = await db
    .select()
    .from(merchantProductsTable)
    .where(and(eq(merchantProductsTable.id, req.params.productId), eq(merchantProductsTable.storeId, store.id)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Product not found in this store" }); return; }

  await db.delete(merchantProductsTable).where(eq(merchantProductsTable.id, existing.id));

  await writeAdminAudit(res.locals.userId as string, "store.product.delete", "merchant_product", existing.id, {
    storeId: store.id, storeName: store.name, productName: existing.name,
  });

  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
router.get("/admin/stores/:storeId/orders", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const orders = await db
    .select()
    .from(merchantOrdersTable)
    .where(eq(merchantOrdersTable.storeId, store.id))
    .orderBy(desc(merchantOrdersTable.createdAt))
    .limit(200);

  res.json(orders.map(merchantOrderView));
});

router.patch("/admin/stores/:storeId/orders/:orderId/status", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const { status, reason } = req.body as { status: string; reason?: string };
  if (!status) { res.status(400).json({ error: "status is required" }); return; }

  const [existing] = await db
    .select()
    .from(merchantOrdersTable)
    .where(and(eq(merchantOrdersTable.id, req.params.orderId), eq(merchantOrdersTable.storeId, store.id)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Order not found in this store" }); return; }

  const [updated] = await db
    .update(merchantOrdersTable)
    .set({ status })
    .where(eq(merchantOrdersTable.id, existing.id))
    .returning();

  await writeAdminAudit(res.locals.userId as string, "store.order.status_update", "merchant_order", updated.id, {
    storeId: store.id, storeName: store.name, prevStatus: existing.status, newStatus: status, reason: reason ?? "",
  });

  res.json(merchantOrderView(updated));
});

// ---------------------------------------------------------------------------
// Coupons for a store (admin-parity)
// Admin-created coupons are auto-approved and skip the normal approval queue.
// ---------------------------------------------------------------------------
router.get("/admin/stores/:storeId/coupons", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }
  const rows = await listCouponsWithStore(eq(couponsTable.storeId, store.id));
  res.json(rows);
});

router.post("/admin/stores/:storeId/coupons", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const { code, title, discountType, discountValue, minOrderValue, maxUses, startsAt, endsAt } = req.body;
  if (!code?.trim() || !title?.trim() || !discountType || discountValue == null || !startsAt || !endsAt) {
    res.status(400).json({ error: "code, title, discountType, discountValue, startsAt and endsAt are required" });
    return;
  }
  if (!["percent", "fixed"].includes(discountType)) {
    res.status(400).json({ error: "discountType must be percent or fixed" }); return;
  }

  try {
    const coupon = await insertCoupon({
      scope: "store",
      store,
      createdBy: res.locals.userId as string,
      status: "approved", // admin-created → auto-approved
      body: {
        code: code.trim().toUpperCase(),
        title: title.trim(),
        discountType,
        discountValue: Number(discountValue),
        minOrderValue: Number(minOrderValue ?? 0),
        maxUses: Number(maxUses ?? 0),
        startsAt,
        endsAt,
      },
    });

    await writeAdminAudit(res.locals.userId as string, "store.coupon.create", "coupon", coupon.id, {
      storeId: store.id, storeName: store.name, code: coupon.code,
    });

    res.status(201).json(couponView(coupon, store.name));
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "This coupon code is already in use" }); return;
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------
// Deals for a store (admin-parity)
// Admin-created deals are auto-approved.
// ---------------------------------------------------------------------------
router.get("/admin/stores/:storeId/deals", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }
  const rows = await listDealsWithStore(eq(promoDealsTable.storeId, store.id));
  res.json(rows);
});

router.post("/admin/stores/:storeId/deals", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const { title, description, discountPercent, startsAt, endsAt } = req.body;
  if (!title?.trim() || !startsAt || !endsAt) {
    res.status(400).json({ error: "title, startsAt and endsAt are required" }); return;
  }
  const startsDate = new Date(startsAt);
  const endsDate = new Date(endsAt);
  if (endsDate <= startsDate) {
    res.status(400).json({ error: "End date must be after start date" }); return;
  }

  const [deal] = await db
    .insert(promoDealsTable)
    .values({
      id: `pdeal_${crypto.randomUUID()}`,
      storeId: store.id,
      title: title.trim(),
      description: description?.trim() ?? "",
      imageUrl: "",
      discountPercent: String(Number(discountPercent ?? 10)),
      startsAt: startsDate,
      endsAt: endsDate,
      status: "approved", // admin-created → auto-approved
    })
    .returning();

  await writeAdminAudit(res.locals.userId as string, "store.deal.create", "promo_deal", deal.id, {
    storeId: store.id, storeName: store.name, title: deal.title,
  });

  res.status(201).json(promoDealView(deal, store.name));
});

// ---------------------------------------------------------------------------
// Group Buys for a store (admin-parity)
// Admin-created campaigns are auto-approved.
// ---------------------------------------------------------------------------
router.get("/admin/stores/:storeId/group-buys", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const deals = await db.select().from(groupBuyDealsTable).where(eq(groupBuyDealsTable.storeId, store.id));
  const progress = await campaignProgress(deals.map((d) => d.id));
  res.json(deals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((d) => campaignView(d, progress(d.id))));
});

router.post("/admin/stores/:storeId/group-buys", requireAdmin, async (req, res): Promise<void> => {
  const store = await resolveStore(req.params.storeId);
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const { title, category, image, originalPrice, groupPrice, cashbackPercent, depositPercent, minParticipants, endsAt } = req.body;
  if (!title?.trim() || !category?.trim() || !originalPrice || !groupPrice || !endsAt) {
    res.status(400).json({ error: "title, category, originalPrice, groupPrice and endsAt are required" }); return;
  }
  const endsDate = new Date(endsAt);
  if (Number.isNaN(endsDate.getTime()) || endsDate.getTime() <= Date.now()) {
    res.status(400).json({ error: "Campaign end date must be in the future" }); return;
  }
  if (Number(groupPrice) >= Number(originalPrice)) {
    res.status(400).json({ error: "Group price must be below the original price" }); return;
  }

  const [deal] = await db
    .insert(groupBuyDealsTable)
    .values({
      id: `gbc_${crypto.randomUUID()}`,
      storeId: store.id,
      approvalStatus: "approved", // admin-created → auto-approved
      title: title.trim(),
      category: category.trim(),
      image: image?.trim() || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80",
      originalPrice: String(Number(originalPrice)),
      groupPrice: String(Number(groupPrice)),
      cashbackPercent: String(Number(cashbackPercent ?? 5)),
      depositPercent: String(Number(depositPercent ?? 20)),
      minParticipants: Math.floor(Number(minParticipants ?? 5)),
      endsAt: endsDate,
      status: "open",
    })
    .returning();

  await writeAdminAudit(res.locals.userId as string, "store.group_buy.create", "group_buy_deal", deal.id, {
    storeId: store.id, storeName: store.name, title: deal.title,
  });

  res.status(201).json(campaignView(deal, { joined: 0, deposits: 0 }));
});

export default router;
