import { and, eq, ilike, or } from "drizzle-orm";
import {
  db,
  marketplaceCategoriesTable,
  marketplaceDealsTable,
  marketplaceProductsTable,
  walletSnapshotsTable,
} from "@workspace/db";
import { money } from "./money";

const categorySeed = [
  { id: "fashion", name: "Fashion", icon: "sparkles", productCount: "284" },
  { id: "electronics", name: "Electronics", icon: "laptop", productCount: "176" },
  { id: "beauty", name: "Beauty", icon: "flower-2", productCount: "142" },
  { id: "home", name: "Home & Living", icon: "house", productCount: "98" },
  { id: "food", name: "Food & Dining", icon: "utensils", productCount: "64" },
  { id: "travel", name: "Travel", icon: "plane", productCount: "41" },
] as const;

const productSeed = [
  {
    id: "linen-overshirt",
    name: "Textured Linen Overshirt",
    brand: "Aarong",
    categoryId: "fashion",
    price: "1890",
    originalPrice: "2490",
    cashbackPercent: "8",
    rating: "4.8",
    reviewCount: "126",
    image:
      "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=85",
    badge: "Best seller",
    merchant: "Aarong",
  },
  {
    id: "sony-headphones",
    name: "WH-1000XM5 Headphones",
    brand: "Sony",
    categoryId: "electronics",
    price: "32900",
    originalPrice: "39990",
    cashbackPercent: "5",
    rating: "4.9",
    reviewCount: "84",
    image:
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=85",
    badge: "Top rated",
    merchant: "Gadget & Gear",
  },
  {
    id: "vitamin-c-serum",
    name: "Vitamin C Brightening Serum",
    brand: "COSRX",
    categoryId: "beauty",
    price: "1650",
    originalPrice: "2200",
    cashbackPercent: "12",
    rating: "4.7",
    reviewCount: "215",
    image:
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=85",
    badge: "12% back",
    merchant: "Shajgoj",
  },
  {
    id: "ceramic-tableware",
    name: "Handmade Ceramic Tableware",
    brand: "Klay",
    categoryId: "home",
    price: "2850",
    originalPrice: "3600",
    cashbackPercent: "7",
    rating: "4.6",
    reviewCount: "63",
    image:
      "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=85",
    badge: "New arrival",
    merchant: "Klay",
  },
  {
    id: "arabica-coffee",
    name: "Single Origin Arabica Box",
    brand: "North End",
    categoryId: "food",
    price: "980",
    originalPrice: "1200",
    cashbackPercent: "10",
    rating: "4.9",
    reviewCount: "191",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85",
    badge: "Staff pick",
    merchant: "North End Coffee",
  },
  {
    id: "weekend-getaway",
    name: "Weekend Getaway for Two",
    brand: "The Palace",
    categoryId: "travel",
    price: "14500",
    originalPrice: "18500",
    cashbackPercent: "15",
    rating: "4.8",
    reviewCount: "48",
    image:
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=900&q=85",
    badge: "15% back",
    merchant: "The Palace Luxury Resort",
  },
] as const;

const dealSeed = [
  {
    id: "midnight-madness",
    title: "Midnight Madness",
    subtitle: "Up to 25% cashback on tech",
    accent: "violet",
    endsAt: new Date("2026-08-04T18:00:00.000Z"),
    cashbackPercent: "25",
  },
  {
    id: "fashion-festival",
    title: "Style Festival",
    subtitle: "Fresh looks, extra rewards",
    accent: "coral",
    endsAt: new Date("2026-08-07T18:00:00.000Z"),
    cashbackPercent: "18",
  },
  {
    id: "weekend-dining",
    title: "Weekend Dining",
    subtitle: "A little more back with every bite",
    accent: "mint",
    endsAt: new Date("2026-08-09T18:00:00.000Z"),
    cashbackPercent: "20",
  },
] as const;

let seedPromise: Promise<void> | undefined;

export function ensureMarketplaceSeeded(): Promise<void> {
  seedPromise ??= (async () => {
    await db
      .insert(marketplaceCategoriesTable)
      .values([...categorySeed])
      .onConflictDoNothing();
    await db
      .insert(marketplaceProductsTable)
      .values([...productSeed])
      .onConflictDoNothing();
    await db
      .insert(marketplaceDealsTable)
      .values([...dealSeed])
      .onConflictDoNothing();
  })();

  return seedPromise;
}

export const categoryView = (row: typeof marketplaceCategoriesTable.$inferSelect) => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  productCount: money(row.productCount),
});

export const productView = (
  row: typeof marketplaceProductsTable.$inferSelect,
  categoryName: string,
) => ({
  id: row.id,
  name: row.name,
  brand: row.brand,
  category: categoryName,
  price: money(row.price),
  originalPrice: money(row.originalPrice),
  cashbackPercent: money(row.cashbackPercent),
  rating: money(row.rating),
  reviewCount: money(row.reviewCount),
  image: row.image,
  badge: row.badge,
  merchant: row.merchant,
});

export const dealView = (row: typeof marketplaceDealsTable.$inferSelect) => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle,
  accent: row.accent,
  endsAt: row.endsAt.toISOString(),
  cashbackPercent: money(row.cashbackPercent),
});

export const walletView = (row: typeof walletSnapshotsTable.$inferSelect) => ({
  balance: money(row.balance),
  pendingCashback: money(row.pendingCashback),
  availableCashback: money(row.availableCashback),
  rewardPoints: money(row.rewardPoints),
});

export const emptyWalletView = () => ({
  balance: 0,
  pendingCashback: 0,
  availableCashback: 0,
  rewardPoints: 0,
});

export async function getOrCreateWallet(userId: string) {
  const [existing] = await db
    .select()
    .from(walletSnapshotsTable)
    .where(eq(walletSnapshotsTable.id, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(walletSnapshotsTable)
    .values({
      id: userId,
      balance: "0.00",
      pendingCashback: "0.00",
      availableCashback: "0.00",
      rewardPoints: "0",
    })
    .returning();

  return created;
}

export async function queryProducts(params: {
  category?: string;
  search?: string;
  limit: number;
}) {
  const filters = [];
  if (params.category) filters.push(eq(marketplaceCategoriesTable.id, params.category));
  if (params.search) {
    filters.push(
      or(
        ilike(marketplaceProductsTable.name, `%${params.search}%`),
        ilike(marketplaceProductsTable.brand, `%${params.search}%`),
        ilike(marketplaceProductsTable.merchant, `%${params.search}%`),
      ),
    );
  }

  return db
    .select({
      product: marketplaceProductsTable,
      categoryName: marketplaceCategoriesTable.name,
    })
    .from(marketplaceProductsTable)
    .innerJoin(
      marketplaceCategoriesTable,
      eq(marketplaceProductsTable.categoryId, marketplaceCategoriesTable.id),
    )
    .where(filters.length ? and(...filters) : undefined)
    .limit(params.limit);
}