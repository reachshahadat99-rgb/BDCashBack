/**
 * Orders domain — cart, checkout, order lifecycle, cashback release.
 *
 * Owns: customerCartsTable, customerCartItemsTable, customerOrdersTable,
 *       customerOrderItemsTable, merchantOrdersTable, merchantProductsTable
 * Cross-cuts: wallet domain (posts cashback transactions inside checkout /
 *             cancel / release transactions via ensureWalletSnapshot).
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  db,
  customerCartsTable,
  customerCartItemsTable,
  customerOrdersTable,
  customerOrderItemsTable,
  merchantOrdersTable,
  merchantProductsTable,
  merchantStoresTable,
  couponsTable,
  walletTransactionsTable,
  walletSnapshotsTable,
  CASHBACK_RETURN_WINDOW_DAYS,
} from "@workspace/db";
import { money, round2 } from "../../lib/money";
import { validateCouponEligibility } from "../../lib/coupon-validator";
import { ensureWalletSnapshot } from "../wallet/wallet.service";

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export async function getOrCreateCart(userId: string) {
  const [existing] = await db
    .select()
    .from(customerCartsTable)
    .where(eq(customerCartsTable.id, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(customerCartsTable)
    .values({ id: userId })
    .returning();

  return created;
}

export async function getCartWithItems(userId: string) {
  await getOrCreateCart(userId);

  const items = await db
    .select()
    .from(customerCartItemsTable)
    .where(eq(customerCartItemsTable.cartId, userId))
    .orderBy(customerCartItemsTable.addedAt);

  return buildCartView(items);
}

function buildCartView(items: (typeof customerCartItemsTable.$inferSelect)[]) {
  const cartItems = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    storeId: item.storeId,
    name: item.name,
    imageUrl: item.imageUrl,
    price: money(item.price),
    originalPrice: money(item.originalPrice),
    cashbackPercent: money(item.cashbackPercent),
    cashbackAmount: round2(
      (money(item.price) * money(item.cashbackPercent) * item.quantity) / 100,
    ),
    quantity: item.quantity,
  }));

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cashbackAmount = cartItems.reduce((s, i) => s + i.cashbackAmount, 0);

  return {
    items: cartItems,
    subtotal: round2(subtotal),
    cashbackAmount: round2(cashbackAmount),
    itemsCount: cartItems.reduce((s, i) => s + i.quantity, 0),
  };
}

export async function addToCart(userId: string, productId: string, quantity: number) {
  await getOrCreateCart(userId);

  const [product] = await db
    .select()
    .from(merchantProductsTable)
    .where(
      and(
        eq(merchantProductsTable.id, productId),
        eq(merchantProductsTable.available, true),
        eq(merchantProductsTable.status, "published"),
      ),
    )
    .limit(1);

  if (!product) return { error: "Product not found or unavailable" as const };
  if (product.stock < quantity) return { error: "Insufficient stock" as const };

  const [existing] = await db
    .select()
    .from(customerCartItemsTable)
    .where(
      and(
        eq(customerCartItemsTable.cartId, userId),
        eq(customerCartItemsTable.productId, productId),
      ),
    )
    .limit(1);

  if (existing) {
    const newQty = existing.quantity + quantity;
    if (product.stock < newQty) return { error: "Insufficient stock" as const };

    await db
      .update(customerCartItemsTable)
      .set({ quantity: newQty })
      .where(eq(customerCartItemsTable.id, existing.id));
  } else {
    await db.insert(customerCartItemsTable).values({
      id: nanoid(),
      cartId: userId,
      productId: product.id,
      storeId: product.storeId,
      name: product.name,
      imageUrl: product.imageUrl,
      price: product.price,
      originalPrice: product.originalPrice,
      cashbackPercent: product.cashbackPercent,
      quantity,
    });
  }

  await db
    .update(customerCartsTable)
    .set({ updatedAt: new Date() })
    .where(eq(customerCartsTable.id, userId));

  return { cart: await getCartWithItems(userId) };
}

export async function updateCartItem(userId: string, itemId: string, quantity: number) {
  const [item] = await db
    .select()
    .from(customerCartItemsTable)
    .where(
      and(
        eq(customerCartItemsTable.id, itemId),
        eq(customerCartItemsTable.cartId, userId),
      ),
    )
    .limit(1);

  if (!item) return { error: "Item not found" as const };

  if (quantity <= 0) {
    await db.delete(customerCartItemsTable).where(eq(customerCartItemsTable.id, itemId));
  } else {
    await db
      .update(customerCartItemsTable)
      .set({ quantity })
      .where(eq(customerCartItemsTable.id, itemId));
  }

  return { cart: await getCartWithItems(userId) };
}

export async function removeCartItem(userId: string, itemId: string) {
  const [item] = await db
    .select()
    .from(customerCartItemsTable)
    .where(
      and(
        eq(customerCartItemsTable.id, itemId),
        eq(customerCartItemsTable.cartId, userId),
      ),
    )
    .limit(1);

  if (!item) return { error: "Item not found" as const };

  await db.delete(customerCartItemsTable).where(eq(customerCartItemsTable.id, itemId));

  return { success: true };
}

export async function clearCart(userId: string) {
  await db.delete(customerCartItemsTable).where(eq(customerCartItemsTable.cartId, userId));
}

// ---------------------------------------------------------------------------
// Checkout — fully atomic
// ---------------------------------------------------------------------------

export interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
}

export async function checkout(userId: string, couponCode?: string, deliveryAddress?: DeliveryAddress) {
  // All financial writes — including the cart read — happen inside a single
  // transaction. We use DELETE...RETURNING to atomically consume the cart,
  // so two concurrent checkout requests cannot both process the same items.
  const result = await db.transaction(async (tx) => {
    // ---- 1. Atomically consume the cart (DELETE...RETURNING) ----
    const cartItems = await tx
      .delete(customerCartItemsTable)
      .where(eq(customerCartItemsTable.cartId, userId))
      .returning();

    if (cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    // ---- 2. Validate products and attempt atomic stock decrement ----
    const productIds = [...new Set(cartItems.map((i) => i.productId))];
    const products = await tx
      .select()
      .from(merchantProductsTable)
      .where(inArray(merchantProductsTable.id, productIds));

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of cartItems) {
      const p = productMap.get(item.productId);
      if (!p || !p.available || p.status !== "published") {
        throw new Error(`Product "${item.name}" is no longer available`);
      }
      // Atomic conditional decrement: only succeeds when stock >= quantity
      const updated = await tx
        .update(merchantProductsTable)
        .set({ stock: sql`${merchantProductsTable.stock} - ${item.quantity}` })
        .where(
          and(
            eq(merchantProductsTable.id, item.productId),
            sql`${merchantProductsTable.stock} >= ${item.quantity}`,
          ),
        )
        .returning({ stock: merchantProductsTable.stock });

      if (updated.length === 0) {
        throw new Error(`Insufficient stock for "${item.name}"`);
      }
    }

    // ---- 3. Compute order subtotal ----
    const subtotal = round2(
      cartItems.reduce((s, i) => s + money(i.price) * i.quantity, 0),
    );
    const totalCashback = round2(
      cartItems.reduce(
        (s, i) =>
          s + round2((money(i.price) * money(i.cashbackPercent) * i.quantity) / 100),
        0,
      ),
    );
    const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);

    // ---- 3b. Validate and apply coupon (if provided) ----
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;

    if (couponCode) {
      const code = couponCode.trim().toUpperCase();
      const storeIds = [...new Set(cartItems.map((i) => i.storeId))];
      const categoryIds = [...new Set(products.map((p) => p.categoryId))];

      const rows = await tx
        .select({ coupon: couponsTable, storeName: merchantStoresTable.name })
        .from(couponsTable)
        .leftJoin(merchantStoresTable, eq(couponsTable.storeId, merchantStoresTable.id))
        .where(eq(couponsTable.code, code))
        .limit(1);

      const row = rows[0];
      if (!row) throw new Error("Coupon code not found");

      const coupon = row.coupon;
      const eligibility = validateCouponEligibility(coupon, { subtotal, storeIds, categoryIds });
      if (!eligibility.valid) throw new Error(eligibility.reason);

      discountAmount = eligibility.discountAmount;

      // Atomically increment usedCount — only within this transaction
      await tx
        .update(couponsTable)
        .set({ usedCount: sql`${couponsTable.usedCount} + 1` })
        .where(eq(couponsTable.id, coupon.id));

      appliedCouponCode = coupon.code;
    }

    const total = round2(Math.max(0, subtotal - discountAmount));

    // ---- 4. Create customer order ----
    const orderId = nanoid();
    const now = new Date();

    const [order] = await tx
      .insert(customerOrdersTable)
      .values({
        id: orderId,
        userId,
        status: "paid",
        total: String(total),
        cashbackAmount: String(totalCashback),
        discountAmount: String(discountAmount),
        couponCode: appliedCouponCode,
        itemsCount: totalItems,
        deliveryAddress: deliveryAddress ? JSON.stringify(deliveryAddress) : null,
      })
      .returning();

    // ---- 5. Group items by store, create merchant orders & order items ----
    const byStore = new Map<string, typeof cartItems>();
    for (const item of cartItems) {
      const list = byStore.get(item.storeId) ?? [];
      list.push(item);
      byStore.set(item.storeId, list);
    }

    const orderItemInserts: (typeof customerOrderItemsTable.$inferInsert)[] = [];

    for (const [storeId, storeItems] of byStore.entries()) {
      const storeTotal = round2(
        storeItems.reduce((s, i) => s + money(i.price) * i.quantity, 0),
      );
      const storeCashback = round2(
        storeItems.reduce(
          (s, i) =>
            s + round2((money(i.price) * money(i.cashbackPercent) * i.quantity) / 100),
          0,
        ),
      );
      const merchantOrderId = nanoid();

      await tx.insert(merchantOrdersTable).values({
        id: merchantOrderId,
        storeId,
        customerId: userId,
        total: String(storeTotal),
        cashback: String(storeCashback),
        itemsCount: storeItems.reduce((s, i) => s + i.quantity, 0),
        status: "pending",
      });

      for (const item of storeItems) {
        const cb = round2(
          (money(item.price) * money(item.cashbackPercent) * item.quantity) / 100,
        );
        orderItemInserts.push({
          id: nanoid(),
          orderId,
          productId: item.productId,
          storeId: item.storeId,
          merchantOrderId,
          name: item.name,
          imageUrl: item.imageUrl,
          price: item.price,
          originalPrice: item.originalPrice,
          cashbackPercent: item.cashbackPercent,
          cashbackAmount: String(cb),
          quantity: item.quantity,
        });
      }
    }

    await tx.insert(customerOrderItemsTable).values(orderItemInserts);

    // ---- 6. Wallet: ensure snapshot exists, add pending cashback ----
    await ensureWalletSnapshot(tx, userId);

    if (totalCashback > 0) {
      await tx.insert(walletTransactionsTable).values({
        id: nanoid(),
        userId,
        type: "cashback_pending",
        amount: String(totalCashback),
        description: `Cashback pending from order #${orderId.slice(-8).toUpperCase()}`,
        referenceId: orderId,
        referenceType: "order",
      });

      await tx
        .update(walletSnapshotsTable)
        .set({
          pendingCashback: sql`${walletSnapshotsTable.pendingCashback} + ${totalCashback}`,
          updatedAt: now,
        })
        .where(eq(walletSnapshotsTable.id, userId));
    }

    // Cart was already consumed by DELETE...RETURNING in step 1
    return order;
  });

  return { order: orderView(result) };
}

// ---------------------------------------------------------------------------
// Order views
// ---------------------------------------------------------------------------

export function orderView(order: typeof customerOrdersTable.$inferSelect) {
  return {
    id: order.id,
    status: order.status,
    total: money(order.total),
    cashbackAmount: money(order.cashbackAmount),
    discountAmount: money(order.discountAmount),
    couponCode: order.couponCode ?? null,
    itemsCount: order.itemsCount,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function orderItemView(item: typeof customerOrderItemsTable.$inferSelect) {
  return {
    id: item.id,
    productId: item.productId,
    storeId: item.storeId,
    name: item.name,
    imageUrl: item.imageUrl,
    price: money(item.price),
    originalPrice: money(item.originalPrice),
    cashbackPercent: money(item.cashbackPercent),
    cashbackAmount: money(item.cashbackAmount),
    quantity: item.quantity,
  };
}

// ---------------------------------------------------------------------------
// Order queries
// ---------------------------------------------------------------------------

export async function listOrders(userId: string) {
  const orders = await db
    .select()
    .from(customerOrdersTable)
    .where(eq(customerOrdersTable.userId, userId))
    .orderBy(desc(customerOrdersTable.createdAt));

  return orders.map(orderView);
}

export async function getOrderDetail(userId: string, orderId: string) {
  const [order] = await db
    .select()
    .from(customerOrdersTable)
    .where(
      and(
        eq(customerOrdersTable.id, orderId),
        eq(customerOrdersTable.userId, userId),
      ),
    )
    .limit(1);

  if (!order) return null;

  const items = await db
    .select()
    .from(customerOrderItemsTable)
    .where(eq(customerOrderItemsTable.orderId, orderId));

  return {
    ...orderView(order),
    items: items.map(orderItemView),
  };
}

// ---------------------------------------------------------------------------
// Order cancellation
// ---------------------------------------------------------------------------

// Cancellable statuses — anything before shipped
const CANCELLABLE_STATUSES = ["pending_payment", "paid", "processing"];

export async function cancelOrder(userId: string, orderId: string) {
  const result = await db.transaction(async (tx) => {
    const now = new Date();

    // Atomic status transition: only updates if order is in a cancellable state
    const updated = await tx
      .update(customerOrdersTable)
      .set({ status: "cancelled", updatedAt: now })
      .where(
        and(
          eq(customerOrdersTable.id, orderId),
          eq(customerOrdersTable.userId, userId),
          inArray(customerOrdersTable.status, CANCELLABLE_STATUSES),
        ),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ status: customerOrdersTable.status })
        .from(customerOrdersTable)
        .where(
          and(
            eq(customerOrdersTable.id, orderId),
            eq(customerOrdersTable.userId, userId),
          ),
        )
        .limit(1);

      if (!existing) throw new Error("ORDER_NOT_FOUND");
      throw new Error(`Cannot cancel an order with status "${existing.status}"`);
    }

    const order = updated[0]!;

    // ---- Restore inventory and cancel merchant orders ----
    const orderItems = await tx
      .select()
      .from(customerOrderItemsTable)
      .where(eq(customerOrderItemsTable.orderId, orderId));

    for (const item of orderItems) {
      await tx
        .update(merchantProductsTable)
        .set({ stock: sql`${merchantProductsTable.stock} + ${item.quantity}` })
        .where(eq(merchantProductsTable.id, item.productId));
    }

    const merchantOrderIds = [
      ...new Set(orderItems.map((i) => i.merchantOrderId).filter(Boolean) as string[]),
    ];
    if (merchantOrderIds.length > 0) {
      await tx
        .update(merchantOrdersTable)
        .set({ status: "cancelled" })
        .where(
          and(
            inArray(merchantOrdersTable.id, merchantOrderIds),
            inArray(merchantOrdersTable.status, ["pending", "processing"]),
          ),
        );
    }

    // ---- Reverse pending cashback ----
    const cashback = money(order.cashbackAmount);

    if (cashback > 0) {
      await ensureWalletSnapshot(tx, userId);

      await tx.insert(walletTransactionsTable).values({
        id: nanoid(),
        userId,
        type: "cashback_reversed",
        amount: String(-cashback),
        description: `Cashback reversed — order #${orderId.slice(-8).toUpperCase()} cancelled`,
        referenceId: orderId,
        referenceType: "order",
      });

      await tx
        .update(walletSnapshotsTable)
        .set({
          pendingCashback: sql`greatest(0, ${walletSnapshotsTable.pendingCashback} - ${cashback})`,
          updatedAt: now,
        })
        .where(eq(walletSnapshotsTable.id, userId));
    }

    return order;
  });

  return { order: orderView(result) };
}

// ---------------------------------------------------------------------------
// Cashback release — fully atomic + idempotent
// ---------------------------------------------------------------------------

/**
 * Release pending cashback for all "delivered" orders past the return window.
 * Each order is processed in its own transaction for fault isolation.
 */
export async function releaseMatureCashback() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CASHBACK_RETURN_WINDOW_DAYS);

  const maturedOrders = await db
    .select()
    .from(customerOrdersTable)
    .where(
      and(
        eq(customerOrdersTable.status, "delivered"),
        sql`${customerOrdersTable.deliveredAt} <= ${cutoff}`,
      ),
    );

  let released = 0;
  for (const order of maturedOrders) {
    const ok = await releaseCashbackForOrder(order.id, order.userId);
    if (ok) released++;
  }

  return released;
}

/**
 * Idempotent: transition exactly one "delivered" order to "completed"
 * and credit cashback. Returns false if the order was already released
 * or did not exist in "delivered" state.
 */
export async function releaseCashbackForOrder(orderId: string, userId: string) {
  const didRelease = await db.transaction(async (tx) => {
    const now = new Date();

    // Atomic status transition: only succeeds once per order
    const updated = await tx
      .update(customerOrdersTable)
      .set({ status: "completed", completedAt: now, updatedAt: now })
      .where(
        and(
          eq(customerOrdersTable.id, orderId),
          eq(customerOrdersTable.status, "delivered"), // idempotency guard
        ),
      )
      .returning({ cashbackAmount: customerOrdersTable.cashbackAmount });

    if (updated.length === 0) {
      // Already completed or wrong state — skip silently
      return false;
    }

    const cashback = money(updated[0]!.cashbackAmount);

    if (cashback > 0) {
      await ensureWalletSnapshot(tx, userId);

      await tx.insert(walletTransactionsTable).values({
        id: nanoid(),
        userId,
        type: "cashback_released",
        amount: String(cashback),
        description: `Cashback released from order #${orderId.slice(-8).toUpperCase()}`,
        referenceId: orderId,
        referenceType: "order",
      });

      await tx
        .update(walletSnapshotsTable)
        .set({
          availableCashback: sql`${walletSnapshotsTable.availableCashback} + ${cashback}`,
          pendingCashback: sql`greatest(0, ${walletSnapshotsTable.pendingCashback} - ${cashback})`,
          balance: sql`${walletSnapshotsTable.balance} + ${cashback}`,
          updatedAt: now,
        })
        .where(eq(walletSnapshotsTable.id, userId));
    }

    return true;
  });

  return didRelease;
}
