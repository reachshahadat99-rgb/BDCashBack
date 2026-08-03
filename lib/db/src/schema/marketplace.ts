import { createInsertSchema } from "drizzle-zod";
import { numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const marketplaceCategoriesTable = pgTable("marketplace_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  productCount: numeric("product_count", { precision: 10, scale: 0 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marketplaceProductsTable = pgTable("marketplace_products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  categoryId: text("category_id")
    .notNull()
    .references(() => marketplaceCategoriesTable.id),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  originalPrice: numeric("original_price", { precision: 12, scale: 2 }).notNull(),
  cashbackPercent: numeric("cashback_percent", { precision: 5, scale: 2 }).notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull(),
  reviewCount: numeric("review_count", { precision: 10, scale: 0 }).notNull().default("0"),
  image: text("image").notNull(),
  badge: text("badge"),
  merchant: text("merchant").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const walletSnapshotsTable = pgTable("wallet_snapshots", {
  id: text("id").primaryKey(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),
  pendingCashback: numeric("pending_cashback", { precision: 12, scale: 2 }).notNull(),
  availableCashback: numeric("available_cashback", { precision: 12, scale: 2 }).notNull(),
  rewardPoints: numeric("reward_points", { precision: 12, scale: 0 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marketplaceDealsTable = pgTable("marketplace_deals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  accent: text("accent").notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  cashbackPercent: numeric("cashback_percent", { precision: 5, scale: 2 }).notNull(),
});

export const insertMarketplaceCategorySchema = createInsertSchema(
  marketplaceCategoriesTable,
).omit({ createdAt: true });
export type InsertMarketplaceCategory = z.infer<
  typeof insertMarketplaceCategorySchema
>;
export type MarketplaceCategory = typeof marketplaceCategoriesTable.$inferSelect;

export const insertMarketplaceProductSchema = createInsertSchema(
  marketplaceProductsTable,
).omit({ createdAt: true });
export type InsertMarketplaceProduct = z.infer<
  typeof insertMarketplaceProductSchema
>;
export type MarketplaceProduct = typeof marketplaceProductsTable.$inferSelect;

export const insertWalletSnapshotSchema = createInsertSchema(
  walletSnapshotsTable,
).omit({ updatedAt: true });
export type InsertWalletSnapshot = z.infer<typeof insertWalletSnapshotSchema>;
export type WalletSnapshot = typeof walletSnapshotsTable.$inferSelect;

export const insertMarketplaceDealSchema = createInsertSchema(
  marketplaceDealsTable,
);
export type InsertMarketplaceDeal = z.infer<typeof insertMarketplaceDealSchema>;
export type MarketplaceDeal = typeof marketplaceDealsTable.$inferSelect;