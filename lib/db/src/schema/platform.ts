import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { merchantStoresTable } from "./marketplace";

/** Platform administrators (Clerk user ids). First signed-in user may claim admin. */
export const adminUsersTable = pgTable("admin_users", {
  userId: text("user_id").primaryKey(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Discount coupons. scope=global (admin) or scope=store (merchant, requires approval). */
export const couponsTable = pgTable(
  "coupons",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(), // global | store
    storeId: text("store_id").references(() => merchantStoresTable.id, {
      onDelete: "cascade",
    }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    discountType: text("discount_type").notNull(), // percent | fixed
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull(),
    minOrderValue: numeric("min_order_value", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    maxUses: integer("max_uses").notNull().default(0), // 0 = unlimited
    usedCount: integer("used_count").notNull().default(0),
    categoryId: text("category_id"), // optional category restriction
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected | archived
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex("coupons_code_unique").on(table.code),
    storeIdx: index("coupons_store_idx").on(table.storeId),
    statusIdx: index("coupons_status_idx").on(table.status),
  }),
);

/** Merchant promotional deals; admin approves and can feature on the homepage. */
export const promoDealsTable = pgTable(
  "promo_deals",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => merchantStoresTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected | removed
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    storeIdx: index("promo_deals_store_idx").on(table.storeId),
    statusIdx: index("promo_deals_status_idx").on(table.status),
  }),
);

/** Gift card brands managed by admin. */
export const giftCardBrandsTable = pgTable("gift_card_brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url").notNull().default(""),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Gift card denominations for sale (discounted digital cards). */
export const giftCardsTable = pgTable(
  "gift_cards",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => giftCardBrandsTable.id, { onDelete: "cascade" }),
    faceValue: numeric("face_value", { precision: 12, scale: 2 }).notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    stock: integer("stock").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    brandIdx: index("gift_cards_brand_idx").on(table.brandId),
  }),
);

/** Delivered gift card purchases. Payment goes through the PaymentService integration point. */
export const giftCardOrdersTable = pgTable(
  "gift_card_orders",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => giftCardsTable.id),
    customerId: text("customer_id").notNull(),
    brandName: text("brand_name").notNull(),
    faceValue: numeric("face_value", { precision: 12, scale: 2 }).notNull(),
    pricePaid: numeric("price_paid", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull(),
    paymentRef: text("payment_ref").notNull(),
    cardCode: text("card_code").notNull(),
    status: text("status").notNull().default("delivered"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerIdx: index("gift_card_orders_customer_idx").on(table.customerId),
  }),
);

/** Category-wise Success Fee configuration (consumed later by the order engine). */
export const successFeeRulesTable = pgTable(
  "success_fee_rules",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id").notNull(),
    feePercent: numeric("fee_percent", { precision: 5, scale: 2 }).notNull(),
    customerSharePercent: numeric("customer_share_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("50"),
    returnPeriodDays: integer("return_period_days").notNull().default(7),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryUnique: uniqueIndex("success_fee_rules_category_unique").on(table.categoryId),
  }),
);

export const insertAdminUserSchema = createInsertSchema(adminUsersTable).omit({
  createdAt: true,
});
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsersTable.$inferSelect;

export const insertCouponSchema = createInsertSchema(couponsTable).omit({ createdAt: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof couponsTable.$inferSelect;

export const insertPromoDealSchema = createInsertSchema(promoDealsTable).omit({
  createdAt: true,
});
export type InsertPromoDeal = z.infer<typeof insertPromoDealSchema>;
export type PromoDeal = typeof promoDealsTable.$inferSelect;

export const insertGiftCardBrandSchema = createInsertSchema(giftCardBrandsTable).omit({
  createdAt: true,
});
export type InsertGiftCardBrand = z.infer<typeof insertGiftCardBrandSchema>;
export type GiftCardBrand = typeof giftCardBrandsTable.$inferSelect;

export const insertGiftCardSchema = createInsertSchema(giftCardsTable).omit({
  createdAt: true,
});
export type InsertGiftCard = z.infer<typeof insertGiftCardSchema>;
export type GiftCard = typeof giftCardsTable.$inferSelect;

export const insertGiftCardOrderSchema = createInsertSchema(giftCardOrdersTable).omit({
  createdAt: true,
});
export type InsertGiftCardOrder = z.infer<typeof insertGiftCardOrderSchema>;
export type GiftCardOrder = typeof giftCardOrdersTable.$inferSelect;

export const insertSuccessFeeRuleSchema = createInsertSchema(successFeeRulesTable).omit({
  createdAt: true,
});
export type InsertSuccessFeeRule = z.infer<typeof insertSuccessFeeRuleSchema>;
export type SuccessFeeRule = typeof successFeeRulesTable.$inferSelect;
