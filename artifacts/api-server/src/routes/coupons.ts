import { Router, type IRouter } from "express";
import {
  CreateMerchantCouponBody,
  CreateMerchantCouponResponse,
  ListMerchantCouponsResponse,
  ListPublicCouponsResponse,
  UpdateMerchantCouponBody,
  UpdateMerchantCouponParams,
  UpdateMerchantCouponResponse,
  ValidateCouponBody,
  ValidateCouponResponse,
} from "@workspace/api-zod";
import { and, eq } from "drizzle-orm";
import { db, couponsTable, merchantStoresTable, type Coupon, type MerchantStore } from "@workspace/db";
import { getMerchantStore } from "../lib/merchant";
import { requireAuth } from "../middleware/auth";
import { money } from "../lib/money";
import { validateCouponEligibility } from "../lib/coupon-validator";
import {
  couponView,
  listCouponsWithStore,
  validateCouponDates,
  validateCouponValues,
  insertCoupon,
} from "../domains/coupons/coupon.service";

const router: IRouter = Router();

router.get("/coupons", async (_req, res): Promise<void> => {
  const now = Date.now();
  const all = await listCouponsWithStore(eq(couponsTable.status, "approved"));
  const live = all.filter(
    (c) => new Date(c.startsAt).getTime() <= now && new Date(c.endsAt).getTime() > now,
  );
  res.json(ListPublicCouponsResponse.parse(live));
});

/** Checkout integration point: read-only validation, never increments usage. */
router.post("/coupons/validate", async (req, res): Promise<void> => {
  const parsed = ValidateCouponBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid validation request" });
    return;
  }
  const { code, subtotal, categoryId, storeId } = parsed.data;

  const fail = (reason: string) =>
    res.json(
      ValidateCouponResponse.parse({ valid: false, discountAmount: 0, reason, coupon: null }),
    );

  const rows = await db
    .select({ coupon: couponsTable, storeName: merchantStoresTable.name })
    .from(couponsTable)
    .leftJoin(merchantStoresTable, eq(couponsTable.storeId, merchantStoresTable.id))
    .where(eq(couponsTable.code, code.trim().toUpperCase()))
    .limit(1);
  const row = rows[0];
  if (!row) {
    fail("Coupon code not found");
    return;
  }

  const result = validateCouponEligibility(row.coupon, {
    subtotal,
    storeIds: storeId ? [storeId] : [],
    categoryIds: categoryId ? [categoryId] : [],
  });

  if (!result.valid) {
    fail(result.reason);
    return;
  }

  res.json(
    ValidateCouponResponse.parse({
      valid: true,
      discountAmount: result.discountAmount,
      reason: null,
      coupon: couponView(row.coupon, row.storeName),
    }),
  );
});

router.get("/merchant/coupons", requireAuth, async (_req, res): Promise<void> => {
  const store = await getMerchantStore(res.locals.userId as string);
  if (!store) {
    res.json(ListMerchantCouponsResponse.parse([]));
    return;
  }
  res.json(
    ListMerchantCouponsResponse.parse(
      await listCouponsWithStore(eq(couponsTable.storeId, store.id)),
    ),
  );
});

router.post("/merchant/coupons", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMerchantCouponBody.safeParse(req.body);
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
  const store = await getMerchantStore(res.locals.userId as string);
  if (!store) {
    res.status(404).json({ error: "Create your store before adding coupons" });
    return;
  }

  try {
    const coupon = await insertCoupon({
      scope: "store",
      store,
      createdBy: res.locals.userId as string,
      status: "pending",
      body: parsed.data,
    });
    res.status(201).json(CreateMerchantCouponResponse.parse(couponView(coupon, store.name)));
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "This coupon code is already in use" });
      return;
    }
    throw error;
  }
});

router.patch("/merchant/coupons/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateMerchantCouponParams.safeParse(req.params);
  const parsed = UpdateMerchantCouponBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid coupon update" });
    return;
  }
  const store = await getMerchantStore(res.locals.userId as string);
  if (!store) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }
  const [existing] = await db
    .select()
    .from(couponsTable)
    .where(and(eq(couponsTable.id, params.data.id), eq(couponsTable.storeId, store.id)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }

  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : existing.startsAt;
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : existing.endsAt;
  const dateError = validateCouponDates(startsAt, endsAt);
  const valueError = validateCouponValues({
    discountType: existing.discountType,
    discountValue: parsed.data.discountValue ?? money(existing.discountValue),
  });
  if (dateError || valueError) {
    res.status(400).json({ error: dateError ?? valueError });
    return;
  }

  const [updated] = await db
    .update(couponsTable)
    .set({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.discountValue !== undefined
        ? { discountValue: String(parsed.data.discountValue) }
        : {}),
      ...(parsed.data.minOrderValue !== undefined
        ? { minOrderValue: String(parsed.data.minOrderValue) }
        : {}),
      ...(parsed.data.maxUses !== undefined ? { maxUses: Math.floor(parsed.data.maxUses) } : {}),
      ...(parsed.data.startsAt !== undefined ? { startsAt } : {}),
      ...(parsed.data.endsAt !== undefined ? { endsAt } : {}),
      // Merchants can only resubmit for approval or archive; approval itself is admin-only.
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    })
    .where(eq(couponsTable.id, existing.id))
    .returning();

  res.json(UpdateMerchantCouponResponse.parse(couponView(updated, store.name)));
});

export default router;
