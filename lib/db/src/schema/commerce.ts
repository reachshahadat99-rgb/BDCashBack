import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { merchantProductsTable, merchantStoresTable } from "./marketplace";

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export const customerCartsTable = pgTable("customer_carts", {
  id: text("id").primaryKey(), // userId is the PK (one cart per user)
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerCartItemsTable = pgTable(
  "customer_cart_items",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id")
      .notNull()
      .references(() => customerCartsTable.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => merchantProductsTable.id, { onDelete: "cascade" }),
    storeId: text("store_id")
      .notNull()
      .references(() => merchantStoresTable.id, { onDelete: "cascade" }),
    // Price snapshot at time of add
    name: text("name").notNull(),
    imageUrl: text("image_url").notNull().default(""),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    originalPrice: numeric("original_price", { precision: 12, scale: 2 }).notNull(),
    cashbackPercent: numeric("cashback_percent", { precision: 5, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cartIdx: index("customer_cart_items_cart_idx").on(table.cartId),
    productIdx: index("customer_cart_items_product_idx").on(table.productId),
  }),
);

// ---------------------------------------------------------------------------
// Customer Orders
// ---------------------------------------------------------------------------

/**
 * Status lifecycle:
 *  pending_payment → paid → processing → shipped → delivered → completed
 *  Any state before delivered → cancelled
 *  delivered/completed → refunded
 */
export const customerOrdersTable = pgTable(
  "customer_orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    // pending_payment | paid | processing | shipped | delivered | completed | cancelled | refunded
    status: text("status").notNull().default("paid"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    cashbackAmount: numeric("cashback_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    itemsCount: integer("items_count").notNull().default(1),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("customer_orders_user_idx").on(table.userId),
    statusIdx: index("customer_orders_status_idx").on(table.status),
    userStatusIdx: index("customer_orders_user_status_idx").on(table.userId, table.status),
  }),
);

export const customerOrderItemsTable = pgTable(
  "customer_order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => customerOrdersTable.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    storeId: text("store_id").notNull(),
    merchantOrderId: text("merchant_order_id"), // FK to merchantOrdersTable populated at checkout
    name: text("name").notNull(),
    imageUrl: text("image_url").notNull().default(""),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    originalPrice: numeric("original_price", { precision: 12, scale: 2 }).notNull(),
    cashbackPercent: numeric("cashback_percent", { precision: 5, scale: 2 }).notNull(),
    cashbackAmount: numeric("cashback_amount", { precision: 12, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => ({
    orderIdx: index("customer_order_items_order_idx").on(table.orderId),
  }),
);

// ---------------------------------------------------------------------------
// Wallet Transactions (ledger)
// ---------------------------------------------------------------------------

/**
 * type values:
 *  cashback_pending   — cashback locked after purchase (order paid)
 *  cashback_released  — cashback moved to available after return window (order completed)
 *  cashback_reversed  — pending cashback reversed after cancellation/refund
 *  withdrawal_requested — user requested a withdrawal
 *  withdrawal_completed — withdrawal transferred
 *  withdrawal_failed    — withdrawal failed; amount returned to balance
 */
export const walletTransactionsTable = pgTable(
  "wallet_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    description: text("description").notNull().default(""),
    referenceId: text("reference_id"), // orderId or withdrawalId
    referenceType: text("reference_type"), // 'order' | 'withdrawal'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("wallet_transactions_user_idx").on(table.userId),
    userCreatedIdx: index("wallet_transactions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Withdrawal Requests
// ---------------------------------------------------------------------------

export const withdrawalRequestsTable = pgTable(
  "withdrawal_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    // pending | processing | completed | failed
    status: text("status").notNull().default("pending"),
    bankName: text("bank_name").notNull().default(""),
    accountNumber: text("account_number").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("withdrawal_requests_user_idx").on(table.userId),
    statusIdx: index("withdrawal_requests_status_idx").on(table.status),
  }),
);

// ---------------------------------------------------------------------------
// Zod insert schemas + types
// ---------------------------------------------------------------------------

export const insertCustomerCartSchema = createInsertSchema(customerCartsTable).omit({
  updatedAt: true,
});
export type InsertCustomerCart = z.infer<typeof insertCustomerCartSchema>;
export type CustomerCart = typeof customerCartsTable.$inferSelect;

export const insertCustomerCartItemSchema = createInsertSchema(customerCartItemsTable).omit({
  addedAt: true,
});
export type InsertCustomerCartItem = z.infer<typeof insertCustomerCartItemSchema>;
export type CustomerCartItem = typeof customerCartItemsTable.$inferSelect;

export const insertCustomerOrderSchema = createInsertSchema(customerOrdersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertCustomerOrder = z.infer<typeof insertCustomerOrderSchema>;
export type CustomerOrder = typeof customerOrdersTable.$inferSelect;

export const insertCustomerOrderItemSchema = createInsertSchema(customerOrderItemsTable);
export type InsertCustomerOrderItem = z.infer<typeof insertCustomerOrderItemSchema>;
export type CustomerOrderItem = typeof customerOrderItemsTable.$inferSelect;

export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable).omit({
  createdAt: true,
});
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequestsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;
export type WithdrawalRequest = typeof withdrawalRequestsTable.$inferSelect;

// Return-window duration in days before cashback is automatically released
export const CASHBACK_RETURN_WINDOW_DAYS = 30;
