/**
 * Watch & Earn Routes
 *
 * System 1 (Rewarded Ad Network):
 *   Vendor stub — integration point is clearly marked below. The DB schema,
 *   reward crediting, fraud detection, and daily-cap enforcement are all live.
 *   Drop in the chosen SDK callback at the marked STUB section.
 *
 * System 2 (Sponsored Merchant Video Campaigns):
 *   Fully implemented. Merchants create campaigns, admin approves them, customers
 *   watch videos and earn Taka rewards credited directly to availableCashback.
 *
 * Fraud Detection (required before any reward credit):
 *   1. Min-duration: completion must arrive at least 70% of videoDurationSeconds
 *      after viewedAt — implausibly fast completions are flagged.
 *   2. Daily cap: at most dailyCapPerUser verified+credited views per user per
 *      campaign per calendar day.
 *   3. IP abuse: >10 distinct userIds from the same IP in 24 h → flag.
 *   4. Device fingerprint abuse: >3 distinct userIds from same fingerprint
 *      in 24 h → flag.
 *   Flagged views go into the admin fraud-flags queue and are never auto-credited.
 */

import { Router, type IRouter } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { getMerchantStore } from "../lib/merchant";
import { nanoid } from "nanoid";
import { and, eq, gte, sql, count, countDistinct } from "drizzle-orm";
import {
  db,
  watchEarnCampaignsTable,
  watchEarnViewsTable,
  walletTransactionsTable,
  walletSnapshotsTable,
} from "@workspace/db";
import { writeAuditLog } from "./admin";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function campaignView(c: typeof watchEarnCampaignsTable.$inferSelect) {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    videoUrl: c.videoUrl,
    rewardPerView: Number(c.rewardPerView),
    videoDurationSeconds: c.videoDurationSeconds,
    budget: Number(c.budget),
    currentViews: c.currentViews,
    maxViews: c.maxViews,
    status: c.status,
    isAdNetwork: c.isAdNetwork,
    startDate: c.startDate,
    endDate: c.endDate,
    createdAt: c.createdAt,
  };
}

function spentBudget(c: typeof watchEarnCampaignsTable.$inferSelect): number {
  return c.currentViews * Number(c.rewardPerView);
}

function hasRemainingBudget(c: typeof watchEarnCampaignsTable.$inferSelect): boolean {
  return spentBudget(c) < Number(c.budget);
}

// ---------------------------------------------------------------------------
// Customer routes
// ---------------------------------------------------------------------------

/**
 * GET /api/watch-earn/campaigns
 * Returns campaigns that are active, within their date window, and have
 * remaining budget. Requires auth so we can later filter by viewed history.
 */
router.get("/watch-earn/campaigns", requireAuth, async (req, res): Promise<void> => {
  const now = new Date();
  const campaigns = await db
    .select()
    .from(watchEarnCampaignsTable)
    .where(
      and(
        eq(watchEarnCampaignsTable.status, "active"),
        sql`${watchEarnCampaignsTable.startDate} <= ${now}`,
        sql`${watchEarnCampaignsTable.endDate} >= ${now}`,
      ),
    );

  const active = campaigns.filter(hasRemainingBudget).map(campaignView);
  res.json(active);
});

/**
 * POST /api/watch-earn/campaigns/:id/view
 * Record a view-start event. Returns a viewId the client uses to report
 * completion. Rejects if the campaign isn't active or daily cap is reached.
 */
router.post("/watch-earn/campaigns/:id/view", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const campaignId = req.params.id as string;

  const [campaign] = await db
    .select()
    .from(watchEarnCampaignsTable)
    .where(eq(watchEarnCampaignsTable.id, campaignId))
    .limit(1);

  if (!campaign || campaign.status !== "active") {
    res.status(404).json({ error: "Campaign not found or not active" });
    return;
  }
  if (!hasRemainingBudget(campaign)) {
    res.status(409).json({ error: "Campaign budget exhausted" });
    return;
  }
  const now = new Date();
  if (campaign.startDate > now || campaign.endDate < now) {
    res.status(409).json({ error: "Campaign is outside its active date window" });
    return;
  }

  // Daily cap check: count verified+credited views for this user+campaign today
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [dayCount] = await db
    .select({ n: count() })
    .from(watchEarnViewsTable)
    .where(
      and(
        eq(watchEarnViewsTable.campaignId, campaignId),
        eq(watchEarnViewsTable.userId, userId),
        eq(watchEarnViewsTable.rewardCredited, true),
        gte(watchEarnViewsTable.viewedAt, todayStart),
      ),
    );
  if ((dayCount?.n ?? 0) >= campaign.dailyCapPerUser) {
    res.status(429).json({
      error: `Daily cap of ${campaign.dailyCapPerUser} views reached for this campaign`,
    });
    return;
  }

  const ipAddress =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";

  const [view] = await db
    .insert(watchEarnViewsTable)
    .values({
      id: `wev_${nanoid()}`,
      campaignId,
      userId,
      ipAddress,
      deviceFingerprint: req.headers["x-device-fingerprint"] as string | undefined,
    })
    .returning();

  res.status(201).json({ viewId: view.id });
});

/**
 * PATCH /api/watch-earn/campaigns/:id/view/:viewId/complete
 * Client reports completion. We verify it against fraud rules before
 * crediting the reward. Body: { watchDurationSeconds: number }
 */
router.patch(
  "/watch-earn/campaigns/:id/view/:viewId/complete",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = res.locals.userId as string;
    const { id: campaignId, viewId } = req.params as { id: string; viewId: string };
    const watchDurationSeconds: number = Number(req.body.watchDurationSeconds) || 0;

    const [view] = await db
      .select()
      .from(watchEarnViewsTable)
      .where(
        and(
          eq(watchEarnViewsTable.id, viewId),
          eq(watchEarnViewsTable.campaignId, campaignId),
          eq(watchEarnViewsTable.userId, userId),
        ),
      )
      .limit(1);

    if (!view) {
      res.status(404).json({ error: "View record not found" });
      return;
    }
    if (view.completed) {
      res.status(409).json({ error: "View already completed" });
      return;
    }

    const [campaign] = await db
      .select()
      .from(watchEarnCampaignsTable)
      .where(eq(watchEarnCampaignsTable.id, campaignId))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const now = new Date();
    const elapsedSeconds = (now.getTime() - view.viewedAt.getTime()) / 1000;
    const minRequired = campaign.videoDurationSeconds * 0.7;

    // -----------------------------------------------------------------------
    // Fraud checks
    // -----------------------------------------------------------------------
    let flagged = false;
    let flagReason: string | null = null;

    // Check 1: minimum watch duration
    if (elapsedSeconds < minRequired || watchDurationSeconds < minRequired) {
      flagged = true;
      flagReason = `completed_too_fast:elapsed=${Math.round(elapsedSeconds)}s,reported=${watchDurationSeconds}s,min=${Math.round(minRequired)}s`;
    }

    // Check 2: IP abuse — more than 10 distinct users from same IP in last 24h
    if (!flagged && view.ipAddress && view.ipAddress !== "unknown") {
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const [ipCount] = await db
        .select({ n: countDistinct(watchEarnViewsTable.userId) })
        .from(watchEarnViewsTable)
        .where(
          and(
            eq(watchEarnViewsTable.ipAddress, view.ipAddress),
            gte(watchEarnViewsTable.viewedAt, since24h),
          ),
        );
      if ((ipCount?.n ?? 0) > 10) {
        flagged = true;
        flagReason = `ip_abuse:ip=${view.ipAddress},users=${ipCount?.n}`;
      }
    }

    // Check 3: device fingerprint abuse — more than 3 distinct users in 24h
    if (!flagged && view.deviceFingerprint) {
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const [devCount] = await db
        .select({ n: countDistinct(watchEarnViewsTable.userId) })
        .from(watchEarnViewsTable)
        .where(
          and(
            eq(watchEarnViewsTable.deviceFingerprint, view.deviceFingerprint),
            gte(watchEarnViewsTable.viewedAt, since24h),
          ),
        );
      if ((devCount?.n ?? 0) > 3) {
        flagged = true;
        flagReason = `device_abuse:fingerprint=${view.deviceFingerprint.slice(0, 12)},users=${devCount?.n}`;
      }
    }

    // -----------------------------------------------------------------------
    // Update view record
    // -----------------------------------------------------------------------
    await db
      .update(watchEarnViewsTable)
      .set({
        completed: true,
        completedAt: now,
        watchDurationSeconds,
        verified: !flagged,
        flagged,
        flagReason,
      })
      .where(eq(watchEarnViewsTable.id, viewId));

    if (flagged) {
      res.json({ credited: false, flagged: true, reason: "under_review" });
      return;
    }

    // -----------------------------------------------------------------------
    // Budget guard — re-check inside a transaction to prevent over-spend
    // -----------------------------------------------------------------------
    const rewardAmount = Math.round(Number(campaign.rewardPerView) * 100) / 100;
    const maxBudget = Number(campaign.budget);

    const credited = await db.transaction(async (tx) => {
      const [fresh] = await tx
        .select()
        .from(watchEarnCampaignsTable)
        .where(eq(watchEarnCampaignsTable.id, campaignId))
        .for("update")
        .limit(1);

      if (!fresh) return false;
      if (spentBudget(fresh) + rewardAmount > maxBudget) {
        // Mark campaign as exhausted and reject credit
        await tx
          .update(watchEarnCampaignsTable)
          .set({ status: "exhausted" })
          .where(eq(watchEarnCampaignsTable.id, campaignId));
        return false;
      }

      // Credit reward
      await tx
        .insert(walletSnapshotsTable)
        .values({
          id: userId,
          balance: "0",
          pendingCashback: "0",
          availableCashback: "0",
          rewardPoints: "0",
        })
        .onConflictDoNothing();

      await tx.insert(walletTransactionsTable).values({
        id: nanoid(),
        userId,
        type: "watch_earn_reward",
        amount: String(rewardAmount),
        description: `Watch & Earn reward — ${campaign.title}`,
        referenceId: campaignId,
        referenceType: "watch_earn_campaign",
      });

      await tx
        .update(walletSnapshotsTable)
        .set({
          availableCashback: sql`${walletSnapshotsTable.availableCashback} + ${rewardAmount}`,
          updatedAt: now,
        })
        .where(eq(walletSnapshotsTable.id, userId));

      await tx
        .update(watchEarnViewsTable)
        .set({ rewardCredited: true })
        .where(eq(watchEarnViewsTable.id, viewId));

      await tx
        .update(watchEarnCampaignsTable)
        .set({ currentViews: sql`${watchEarnCampaignsTable.currentViews} + 1` })
        .where(eq(watchEarnCampaignsTable.id, campaignId));

      return true;
    });

    if (!credited) {
      res.json({ credited: false, flagged: false, reason: "budget_exhausted" });
      return;
    }

    res.json({ credited: true, amount: rewardAmount });
  },
);

// ---------------------------------------------------------------------------
// Merchant routes
// ---------------------------------------------------------------------------

/**
 * GET /api/merchant/watch-earn/campaigns
 * Merchant's own campaigns with performance stats.
 */
router.get(
  "/merchant/watch-earn/campaigns",
  requireAuth,
  async (req, res): Promise<void> => {
    const store = await getMerchantStore(res.locals.userId as string);
    if (!store) {
      res.status(403).json({ error: "No merchant store found. Set one up first." });
      return;
    }

    const campaigns = await db
      .select()
      .from(watchEarnCampaignsTable)
      .where(eq(watchEarnCampaignsTable.merchantStoreId, store.id));

    res.json(
      campaigns
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((c) => ({
          ...campaignView(c),
          spentBudget: spentBudget(c),
          remainingBudget: Math.max(0, Number(c.budget) - spentBudget(c)),
        })),
    );
  },
);

/**
 * POST /api/merchant/watch-earn/campaigns
 * Create a sponsored video campaign (starts in "pending" status for admin approval).
 */
router.post(
  "/merchant/watch-earn/campaigns",
  requireAuth,
  async (req, res): Promise<void> => {
    const store = await getMerchantStore(res.locals.userId as string);
    if (!store) {
      res.status(403).json({ error: "No merchant store found." });
      return;
    }

    const {
      title,
      description,
      videoUrl,
      budget,
      rewardPerView,
      maxViews,
      videoDurationSeconds,
      dailyCapPerUser,
      startDate,
      endDate,
    } = req.body as Record<string, unknown>;

    if (
      !title ||
      !videoUrl ||
      !budget ||
      !rewardPerView ||
      !maxViews ||
      !startDate ||
      !endDate
    ) {
      res
        .status(400)
        .json({ error: "title, videoUrl, budget, rewardPerView, maxViews, startDate, endDate are required" });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      res.status(400).json({ error: "endDate must be after startDate" });
      return;
    }
    if (Number(rewardPerView) > Number(budget) / Number(maxViews) * 2) {
      res.status(400).json({ error: "rewardPerView is too high relative to budget and maxViews" });
      return;
    }

    const [campaign] = await db
      .insert(watchEarnCampaignsTable)
      .values({
        id: `wec_${nanoid()}`,
        merchantStoreId: store.id,
        isAdNetwork: false,
        title: String(title).trim(),
        description: description ? String(description).trim() : "",
        videoUrl: String(videoUrl).trim(),
        budget: String(Number(budget)),
        rewardPerView: String(Number(rewardPerView)),
        maxViews: Math.floor(Number(maxViews)),
        videoDurationSeconds: Math.floor(Number(videoDurationSeconds ?? 30)),
        dailyCapPerUser: Math.floor(Number(dailyCapPerUser ?? 3)),
        startDate: start,
        endDate: end,
        status: "pending",
      })
      .returning();

    res.status(201).json(campaignView(campaign));
  },
);

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/watch-earn/campaigns
 * All campaigns across all merchants.
 */
router.get(
  "/admin/watch-earn/campaigns",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const campaigns = await db
      .select()
      .from(watchEarnCampaignsTable);
    res.json(
      campaigns
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((c) => ({
          ...campaignView(c),
          spentBudget: spentBudget(c),
          remainingBudget: Math.max(0, Number(c.budget) - spentBudget(c)),
        })),
    );
  },
);

/**
 * PATCH /api/admin/watch-earn/campaigns/:id/status
 * Approve, reject, pause, or activate a campaign.
 * Body: { status: "approved" | "rejected" | "active" | "paused" | "completed" }
 */
router.patch(
  "/admin/watch-earn/campaigns/:id/status",
  requireAdmin,
  async (req, res): Promise<void> => {
    const campaignId = req.params.id as string;
    const newStatus = req.body.status as string | undefined;

    const ALLOWED = ["approved", "rejected", "active", "paused", "completed"] as const;
    if (!newStatus || !(ALLOWED as readonly string[]).includes(newStatus)) {
      res.status(400).json({ error: `status must be one of: ${ALLOWED.join(", ")}` });
      return;
    }

    const [campaign] = await db
      .select()
      .from(watchEarnCampaignsTable)
      .where(eq(watchEarnCampaignsTable.id, campaignId))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const [updated] = await db
      .update(watchEarnCampaignsTable)
      .set({ status: newStatus })
      .where(eq(watchEarnCampaignsTable.id, campaignId))
      .returning();

    await writeAuditLog(
      res.locals.userId as string,
      `watch_earn.campaign.${newStatus}`,
      "watch_earn_campaign",
      campaignId,
      { title: campaign.title, previousStatus: campaign.status },
    );

    res.json(campaignView(updated));
  },
);

/**
 * GET /api/admin/watch-earn/fraud-flags
 * Returns all flagged view records for admin manual review.
 */
router.get(
  "/admin/watch-earn/fraud-flags",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const flags = await db
      .select()
      .from(watchEarnViewsTable)
      .where(eq(watchEarnViewsTable.flagged, true));

    res.json(
      flags
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((v) => ({
          id: v.id,
          campaignId: v.campaignId,
          userId: v.userId,
          viewedAt: v.viewedAt,
          completedAt: v.completedAt,
          watchDurationSeconds: v.watchDurationSeconds,
          ipAddress: v.ipAddress,
          deviceFingerprint: v.deviceFingerprint,
          flagReason: v.flagReason,
          rewardCredited: v.rewardCredited,
          createdAt: v.createdAt,
        })),
    );
  },
);

// ---------------------------------------------------------------------------
// STUB: System 1 — Rewarded Ad Network integration point
// ---------------------------------------------------------------------------
//
// When the ad-network vendor is confirmed, add a route here:
//
//   router.post("/watch-earn/ad-callback", async (req, res) => {
//     // 1. Verify the callback signature from the chosen vendor SDK
//     // 2. Look up the watchEarnView row by the vendor's transaction ID
//     // 3. Run the same fraud checks as the /complete route above
//     // 4. Credit via the same wallet transaction pattern
//   });
//
// Until then, platform ad-network campaigns (isAdNetwork=true) can be
// seeded by an admin and show the same UI as sponsored campaigns, but
// the completion callback URL is left as a manual URL until the SDK is wired.
// ---------------------------------------------------------------------------

export default router;
