/**
 * Coupons domain — CRUD helpers and view transformations.
 *
 * This module is the single source of coupon service functions.
 * Previously these lived as exports in routes/coupons.ts, creating an
 * inverted dependency where admin imported from a peer route file.
 */

import { eq } from "drizzle-orm";
import { db, couponsTable, merchantStoresTable, type Coupon, type MerchantStore } from "@workspace/db";
import { money } from "../../lib/money";

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

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
