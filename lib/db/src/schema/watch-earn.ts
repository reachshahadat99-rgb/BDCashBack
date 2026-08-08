import {
  pgTable,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Watch & Earn — System 2: Sponsored Merchant Video Campaigns
 *
 * Merchants pay per verified view. Budget is enforced; once
 * currentViews * rewardPerView >= budget the campaign auto-exhausts.
 *
 * Status lifecycle:
 *   pending → approved / rejected → active → paused / exhausted / completed
 *
 * System 1 (rewarded ad-network) shares this table — isAdNetwork = true rows
 * are platform-managed with merchantStoreId = null. The ad-network SDK
 * integration point is in routes/watch-earn.ts (clearly stubbed until vendor
 * is confirmed).
 */
export const watchEarnCampaignsTable = pgTable("watch_earn_campaigns", {
  id: text("id").primaryKey(),
  /** null for platform-level ad-network campaigns */
  merchantStoreId: text("merchant_store_id"),
  /** true = ad-network (System 1), false = merchant-sponsored (System 2) */
  isAdNetwork: boolean("is_ad_network").notNull().default(false),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  /** Video URL (Cloudinary, YouTube embed, or any HTTPS video URL) */
  videoUrl: text("video_url").notNull(),
  /** Total budget in Taka (BDT) */
  budget: numeric("budget", { precision: 12, scale: 2 }).notNull(),
  /** Reward per verified view in Taka */
  rewardPerView: numeric("reward_per_view", { precision: 10, scale: 2 }).notNull(),
  maxViews: integer("max_views").notNull(),
  currentViews: integer("current_views").notNull().default(0),
  /**
   * Minimum video length in seconds — used by fraud check to reject
   * completions that arrive impossibly fast.
   */
  videoDurationSeconds: integer("video_duration_seconds").notNull().default(30),
  /**
   * Max verified rewards granted to the same user in one calendar day.
   * Platform default is 3; merchants can set a lower cap per campaign.
   */
  dailyCapPerUser: integer("daily_cap_per_user").notNull().default(3),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  /** pending | approved | rejected | active | paused | exhausted | completed */
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per view attempt (start event).
 * Completion and verification are recorded on the same row.
 * Flagged rows appear in the admin fraud queue and are never auto-credited.
 */
export const watchEarnViewsTable = pgTable(
  "watch_earn_views",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => watchEarnCampaignsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Client reported completion (untrusted) */
    completed: boolean("completed").notNull().default(false),
    /** Platform-verified completion (trusted — passes all fraud checks) */
    verified: boolean("verified").notNull().default(false),
    /** Reward has been credited to the user's wallet */
    rewardCredited: boolean("reward_credited").notNull().default(false),
    deviceFingerprint: text("device_fingerprint"),
    ipAddress: text("ip_address"),
    /** Seconds the client reports watching (used for min-duration check) */
    watchDurationSeconds: integer("watch_duration_seconds"),
    /** Flagged for admin manual review — never auto-credited while true */
    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("watch_earn_views_campaign_idx").on(table.campaignId),
    userIdx: index("watch_earn_views_user_idx").on(table.userId),
    ipIdx: index("watch_earn_views_ip_idx").on(table.ipAddress),
    deviceIdx: index("watch_earn_views_device_idx").on(table.deviceFingerprint),
  }),
);

export type WatchEarnCampaign = typeof watchEarnCampaignsTable.$inferSelect;
export type WatchEarnView = typeof watchEarnViewsTable.$inferSelect;
