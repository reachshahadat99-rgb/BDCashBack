/**
 * Single source of truth for coupon eligibility rules.
 *
 * Both the read-only validate endpoint (routes/coupons.ts) and the
 * transactional checkout path (lib/orders.ts) call this instead of
 * maintaining their own copies of the same checks.
 */

import type { Coupon } from "@workspace/db";
import { money } from "./money";

export interface CouponEligibilityInput {
  /** Cart/order subtotal BEFORE any discount. */
  subtotal: number;
  /**
   * All store IDs represented in the cart.
   * The validate endpoint may pass a single-element array.
   */
  storeIds: string[];
  /**
   * All category IDs represented in the cart.
   * The validate endpoint may pass a single-element array.
   */
  categoryIds: string[];
}

export type CouponValidationResult =
  | { valid: true; discountAmount: number }
  | { valid: false; reason: string };

/**
 * Validate a coupon row against a given cart context.
 * Pure function — never mutates the database.
 */
export function validateCouponEligibility(
  coupon: Coupon,
  input: CouponEligibilityInput,
): CouponValidationResult {
  const { subtotal, storeIds, categoryIds } = input;
  const now = Date.now();

  if (coupon.status !== "approved") {
    return { valid: false, reason: "This coupon is not active" };
  }
  if (coupon.startsAt.getTime() > now) {
    return { valid: false, reason: "This coupon is not valid yet" };
  }
  if (coupon.endsAt.getTime() <= now) {
    return { valid: false, reason: "This coupon has expired" };
  }
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: "This coupon has reached its usage limit" };
  }

  const minOrder = money(coupon.minOrderValue);
  if (minOrder > subtotal) {
    return { valid: false, reason: `Minimum order value is ৳${minOrder}` };
  }

  if (coupon.categoryId && !categoryIds.includes(coupon.categoryId)) {
    return {
      valid: false,
      reason: "This coupon only applies to a specific category not in your cart",
    };
  }
  if (coupon.scope === "store" && coupon.storeId && !storeIds.includes(coupon.storeId)) {
    return { valid: false, reason: "This coupon only applies at its issuing store" };
  }

  const discountAmount =
    coupon.discountType === "percent"
      ? Math.round((subtotal * money(coupon.discountValue)) / 100)
      : Math.min(subtotal, money(coupon.discountValue));

  return { valid: true, discountAmount };
}
