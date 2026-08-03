import { and, count, eq, inArray, ne, sql, sum } from "drizzle-orm";
import {
  db,
  customerOrderItemsTable,
  customerOrdersTable,
  marketplaceCategoriesTable,
  merchantOrdersTable,
  merchantProductsTable,
  merchantStoresTable,
} from "@workspace/db";
import { money } from "./money";

export const storeView = (store: typeof merchantStoresTable.$inferSelect) => ({
  id: store.id,
  name: store.name,
  slug: store.slug,
  description: store.description,
  logoUrl: store.logoUrl,
  status: store.status,
  createdAt: store.createdAt.toISOString(),
  updatedAt: store.updatedAt.toISOString(),
});

export const merchantProductView = (
  product: typeof merchantProductsTable.$inferSelect,
  categoryName: string,
) => ({
  id: product.id,
  storeId: product.storeId,
  categoryId: product.categoryId,
  categoryName,
  name: product.name,
  description: product.description,
  brand: product.brand,
  price: money(product.price),
  originalPrice: money(product.originalPrice),
  cashbackPercent: money(product.cashbackPercent),
  imageUrl: product.imageUrl,
  stock: product.stock,
  available: product.available,
  status: product.status,
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt.toISOString(),
});

export const merchantOrderView = (
  order: typeof merchantOrdersTable.$inferSelect,
) => ({
  id: order.id,
  storeId: order.storeId,
  customerId: order.customerId,
  total: money(order.total),
  cashback: money(order.cashback),
  itemsCount: order.itemsCount,
  status: order.status,
  createdAt: order.createdAt.toISOString(),
});

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function getMerchantStore(ownerId: string) {
  const [store] = await db
    .select()
    .from(merchantStoresTable)
    .where(eq(merchantStoresTable.ownerId, ownerId))
    .limit(1);
  return store;
}

export async function listOwnedProducts(ownerId: string) {
  const store = await getMerchantStore(ownerId);
  if (!store) return { store: undefined, products: [] };

  const products = await db
    .select({
      product: merchantProductsTable,
      categoryName: marketplaceCategoriesTable.name,
    })
    .from(merchantProductsTable)
    .innerJoin(
      marketplaceCategoriesTable,
      eq(merchantProductsTable.categoryId, marketplaceCategoriesTable.id),
    )
    .where(eq(merchantProductsTable.storeId, store.id))
    .orderBy(sql`${merchantProductsTable.createdAt} desc`);

  return {
    store,
    products: products.map(({ product, categoryName }) =>
      merchantProductView(product, categoryName),
    ),
  };
}

export async function getOwnedProduct(ownerId: string, productId: string) {
  const [result] = await db
    .select({
      product: merchantProductsTable,
      categoryName: marketplaceCategoriesTable.name,
      storeOwnerId: merchantStoresTable.ownerId,
    })
    .from(merchantProductsTable)
    .innerJoin(
      merchantStoresTable,
      eq(merchantProductsTable.storeId, merchantStoresTable.id),
    )
    .innerJoin(
      marketplaceCategoriesTable,
      eq(merchantProductsTable.categoryId, marketplaceCategoriesTable.id),
    )
    .where(
      and(
        eq(merchantProductsTable.id, productId),
        eq(merchantStoresTable.ownerId, ownerId),
      ),
    )
    .limit(1);

  return result;
}

export async function getMerchantSummary(ownerId: string) {
  const store = await getMerchantStore(ownerId);
  if (!store) {
    return {
      store: null,
      productCount: 0,
      activeProductCount: 0,
      orderCount: 0,
      grossSales: 0,
      cashbackIssued: 0,
      pendingOrders: 0,
    };
  }

  const [productStats, orderStats] = await Promise.all([
    db
      .select({
        productCount: count(merchantProductsTable.id),
        activeProductCount: sql<number>`count(*) filter (where ${merchantProductsTable.status} = 'published' and ${merchantProductsTable.available} = true)`,
      })
      .from(merchantProductsTable)
      .where(
        and(
          eq(merchantProductsTable.storeId, store.id),
          ne(merchantProductsTable.status, "archived"),
        ),
      ),
    db
      .select({
        orderCount: count(merchantOrdersTable.id),
        grossSales: sum(merchantOrdersTable.total),
        cashbackIssued: sum(merchantOrdersTable.cashback),
        pendingOrders: sql<number>`count(*) filter (where ${merchantOrdersTable.status} in ('pending', 'processing'))`,
      })
      .from(merchantOrdersTable)
      .where(eq(merchantOrdersTable.storeId, store.id)),
  ]);

  return {
    store: storeView(store),
    productCount: Number(productStats[0]?.productCount ?? 0),
    activeProductCount: Number(productStats[0]?.activeProductCount ?? 0),
    orderCount: Number(orderStats[0]?.orderCount ?? 0),
    grossSales: money(orderStats[0]?.grossSales),
    cashbackIssued: money(orderStats[0]?.cashbackIssued),
    pendingOrders: Number(orderStats[0]?.pendingOrders ?? 0),
  };
}

export async function listMerchantOrders(ownerId: string) {
  const store = await getMerchantStore(ownerId);
  if (!store) return [];

  const orders = await db
    .select()
    .from(merchantOrdersTable)
    .where(eq(merchantOrdersTable.storeId, store.id))
    .orderBy(sql`${merchantOrdersTable.createdAt} desc`);

  return orders.map(merchantOrderView);
}

// ---------------------------------------------------------------------------
// Merchant order status transitions
// Valid forward-only path: pending → processing → shipped → delivered
// When all merchant orders under a customer order reach delivered/cancelled,
// the customer order is automatically marked delivered so cashback can release.
// ---------------------------------------------------------------------------

const MERCHANT_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
};

export async function updateMerchantOrderStatus(
  ownerId: string,
  merchantOrderId: string,
  newStatus: "processing" | "shipped" | "delivered",
) {
  return db.transaction(async (tx) => {
    // 1. Resolve store for this merchant
    const [store] = await tx
      .select({ id: merchantStoresTable.id })
      .from(merchantStoresTable)
      .where(eq(merchantStoresTable.ownerId, ownerId))
      .limit(1);

    if (!store) throw new Error("STORE_NOT_FOUND");

    // 2. Load and verify ownership of the merchant order
    const [order] = await tx
      .select()
      .from(merchantOrdersTable)
      .where(
        and(
          eq(merchantOrdersTable.id, merchantOrderId),
          eq(merchantOrdersTable.storeId, store.id),
        ),
      )
      .limit(1);

    if (!order) throw new Error("ORDER_NOT_FOUND");

    // 3. Guard: only allow valid forward transitions
    const allowed = MERCHANT_STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Cannot transition merchant order from "${order.status}" to "${newStatus}"`,
      );
    }

    // 4. Update the merchant order
    const [updated] = await tx
      .update(merchantOrdersTable)
      .set({ status: newStatus })
      .where(eq(merchantOrdersTable.id, merchantOrderId))
      .returning();

    // 5. If delivered: check whether all sibling merchant orders are done,
    //    and if so mark the customer order as delivered (triggers cashback release)
    if (newStatus === "delivered") {
      // Find the customer order that contains this merchant order
      const [item] = await tx
        .select({ orderId: customerOrderItemsTable.orderId })
        .from(customerOrderItemsTable)
        .where(eq(customerOrderItemsTable.merchantOrderId, merchantOrderId))
        .limit(1);

      if (item) {
        // Get every merchant order ID linked to this customer order
        const siblings = await tx
          .select({ merchantOrderId: customerOrderItemsTable.merchantOrderId })
          .from(customerOrderItemsTable)
          .where(eq(customerOrderItemsTable.orderId, item.orderId));

        const siblingIds = [
          ...new Set(
            siblings.map((s) => s.merchantOrderId).filter(Boolean) as string[],
          ),
        ];

        // All must be delivered or cancelled for the customer order to be delivered
        const siblingRows = await tx
          .select({ status: merchantOrdersTable.status })
          .from(merchantOrdersTable)
          .where(inArray(merchantOrdersTable.id, siblingIds));

        const allDone = siblingRows.every(
          (r) => r.status === "delivered" || r.status === "cancelled",
        );

        if (allDone) {
          const now = new Date();
          await tx
            .update(customerOrdersTable)
            .set({ status: "delivered", deliveredAt: now, updatedAt: now })
            .where(
              and(
                eq(customerOrdersTable.id, item.orderId),
                // Idempotency guard: only advance if not already delivered/completed
                inArray(customerOrdersTable.status, ["paid", "processing", "shipped"]),
              ),
            );
        }
      }
    }

    return merchantOrderView(updated!);
  });
}