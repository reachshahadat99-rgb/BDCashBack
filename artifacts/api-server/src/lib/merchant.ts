import { and, count, eq, ne, sql, sum } from "drizzle-orm";
import {
  db,
  marketplaceCategoriesTable,
  merchantOrdersTable,
  merchantProductsTable,
  merchantStoresTable,
} from "@workspace/db";

const money = (value: string | number | null | undefined) => Number(value ?? 0);

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