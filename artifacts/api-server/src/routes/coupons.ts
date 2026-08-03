import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
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

export function couponView(coupon: Coupon, storeName: string | null) {
  return {
    id: coupon.id,
    scope: coupon.scope,
    storeId: coupon.storeId,
    storeName,
    code: coupon.code,
    title: coupon.title,
    discountType: coupon.discountType,
    discountValue: money(coupon.discountValue),
    minOrderValue: money(coupon.minOrderValue),
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    categoryId: coupon.categoryId,
    startsAt: coupon.startsAt.toISOString(),
    endsAt: coupon.endsAt.toISOString(),
    status: coupon.status,
    createdAt: coupon.createdAt.toISOString(),
  };
}

export async function listCouponsWithStore(where?: ReturnType<typeof eq>) {
  const rows = await db
    .select({ coupon: couponsTable, storeName: merchantStoresTable.name })
    .from(couponsTable)
    .leftJoin(merchantStoresTable, eq(couponsTable.storeId, merchantStoresTable.id))
    .where(where);
  return rows
    .sort((a, b) => b.coupon.createdAt.getTime() - a.coupon.createdAt.getTime())
    .map((r) => couponView(r.coupon, r.storeName));
}

export function validateCouponDates(startsAt: Date, endsAt: Date): string | undefined {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return "Valid start and end dates are required";
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return "End date must be after the start date";
  }
  return undefined;
}

export function validateCouponValues(input: {
  discountType: string;
  discountValue: number;
}): string | undefined {
  if (input.discountValue <= 0) return "Discount value must be greater than zero";
  if (input.discountType === "percent" && input.discountValue > 90) {
    return "Percent discounts cannot exceed 90%";
  }
  return undefined;
}

export async function insertCoupon(input: {
  scope: "global" | "store";
  store: MerchantStore | null;
  createdBy: string;
  status: string;
  body: {
    code: string;
    title: string;
    discountType: string;
    discountValue: number;
    minOrderValue?: number;
    maxUses?: number;
    categoryId?: string;
    startsAt: string;
    endsAt: string;
  };
}) {
  const [coupon] = await db
    .insert(couponsTable)
    .values({
      id: `coupon_${crypto.randomUUID()}`,
      scope: input.scope,
      storeId: input.store?.id ?? null,
      code: input.body.code.trim().toUpperCase(),
      title: input.body.title.trim(),
      discountType: input.body.discountType,
      discountValue: String(input.body.discountValue),
      minOrderValue: String(input.body.minOrderValue ?? 0),
      maxUses: Math.floor(input.body.maxUses ?? 0),
      categoryId: input.body.categoryId ?? null,
      startsAt: new Date(input.body.startsAt),
      endsAt: new Date(input.body.endsAt),
      status: input.status,
      createdBy: input.createdBy,
    })
    .returning();
  return coupon;
}

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
  const coupon = row.coupon;
  const now = Date.now();
  if (coupon.status !== "approved") {
    fail("This coupon is not active");
    return;
  }
  if (coupon.startsAt.getTime() > now) {
    fail("This coupon is not valid yet");
    return;
  }
  if (coupon.endsAt.getTime() <= now) {
    fail("This coupon has expired");
    return;
  }
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    fail("This coupon has reached its usage limit");
    return;
  }
  if (money(coupon.minOrderValue) > subtotal) {
    fail(`Minimum order value is ৳${money(coupon.minOrderValue)}`);
    return;
  }
  if (coupon.categoryId && coupon.categoryId !== categoryId) {
    fail("This coupon only applies to a specific category");
    return;
  }
  if (coupon.scope === "store" && coupon.storeId !== storeId) {
    fail("This coupon only applies at its issuing store");
    return;
  }

  const discountAmount =
    coupon.discountType === "percent"
      ? Math.round((subtotal * money(coupon.discountValue)) / 100)
      : Math.min(subtotal, money(coupon.discountValue));

  res.json(
    ValidateCouponResponse.parse({
      valid: true,
      discountAmount,
      reason: null,
      coupon: couponView(coupon, row.storeName),
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
