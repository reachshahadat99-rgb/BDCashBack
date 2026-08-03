import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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

export const merchantStoresTable = pgTable(
  "merchant_stores",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    logoUrl: text("logo_url").notNull().default(""),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("merchant_stores_owner_idx").on(table.ownerId),
    ownerSlugUnique: uniqueIndex("merchant_stores_owner_slug_unique").on(
      table.ownerId,
      table.slug,
    ),
  }),
);

export const merchantProductsTable = pgTable(
  "merchant_products",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => merchantStoresTable.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => marketplaceCategoriesTable.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    brand: text("brand").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    originalPrice: numeric("original_price", { precision: 12, scale: 2 }).notNull(),
    cashbackPercent: numeric("cashback_percent", { precision: 5, scale: 2 }).notNull(),
    imageUrl: text("image_url").notNull().default(""),
    stock: integer("stock").notNull().default(0),
    available: boolean("available").notNull().default(true),
    status: text("status").notNull().default("published"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    storeIdx: index("merchant_products_store_idx").on(table.storeId),
    categoryIdx: index("merchant_products_category_idx").on(table.categoryId),
    statusIdx: index("merchant_products_status_idx").on(table.status),
  }),
);

export const merchantOrdersTable = pgTable(
  "merchant_orders",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => merchantStoresTable.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    cashback: numeric("cashback", { precision: 12, scale: 2 }).notNull(),
    itemsCount: integer("items_count").notNull().default(1),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    storeIdx: index("merchant_orders_store_idx").on(table.storeId),
    statusIdx: index("merchant_orders_status_idx").on(table.status),
  }),
);

export const insertMerchantStoreSchema = createInsertSchema(merchantStoresTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertMerchantStore = z.infer<typeof insertMerchantStoreSchema>;
export type MerchantStore = typeof merchantStoresTable.$inferSelect;

export const insertMerchantProductSchema = createInsertSchema(merchantProductsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertMerchantProduct = z.infer<typeof insertMerchantProductSchema>;
export type MerchantProduct = typeof merchantProductsTable.$inferSelect;

export const insertMerchantOrderSchema = createInsertSchema(merchantOrdersTable).omit({
  createdAt: true,
});
export type InsertMerchantOrder = z.infer<typeof insertMerchantOrderSchema>;
export type MerchantOrder = typeof merchantOrdersTable.$inferSelect;

export const groupBuyDealsTable = pgTable("group_buy_deals", {
  id: text("id").primaryKey(),
  /** Owning merchant store; null for platform-seeded campaigns. */
  storeId: text("store_id"),
  /** pending | approved | rejected — merchant campaigns need admin approval. */
  approvalStatus: text("approval_status").notNull().default("approved"),
  title: text("title").notNull(),
  image: text("image").notNull(),
  category: text("category").notNull(),
  originalPrice: numeric("original_price", { precision: 12, scale: 2 }).notNull(),
  groupPrice: numeric("group_price", { precision: 12, scale: 2 }).notNull(),
  cashbackPercent: numeric("cashback_percent", { precision: 5, scale: 2 }).notNull(),
  depositPercent: numeric("deposit_percent", { precision: 5, scale: 2 }).notNull().default("20"),
  minParticipants: integer("min_participants").notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupBuyOrdersTable = pgTable(
  "group_buy_orders",
  {
    id: text("id").primaryKey(),
    dealId: text("deal_id")
      .notNull()
      .references(() => groupBuyDealsTable.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    depositPaid: numeric("deposit_paid", { precision: 12, scale: 2 }).notNull(),
    dueAmount: numeric("due_amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull(),
    paymentRef: text("payment_ref").notNull(),
    status: text("status").notNull().default("reserved"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dealIdx: index("group_buy_orders_deal_idx").on(table.dealId),
    customerIdx: index("group_buy_orders_customer_idx").on(table.customerId),
    dealCustomerUnique: uniqueIndex("group_buy_orders_deal_customer_unique").on(
      table.dealId,
      table.customerId,
    ),
  }),
);

export const insertGroupBuyDealSchema = createInsertSchema(groupBuyDealsTable).omit({
  createdAt: true,
});
export type InsertGroupBuyDeal = z.infer<typeof insertGroupBuyDealSchema>;
export type GroupBuyDeal = typeof groupBuyDealsTable.$inferSelect;

export const insertGroupBuyOrderSchema = createInsertSchema(groupBuyOrdersTable).omit({
  createdAt: true,
});
export type InsertGroupBuyOrder = z.infer<typeof insertGroupBuyOrderSchema>;
export type GroupBuyOrder = typeof groupBuyOrdersTable.$inferSelect;