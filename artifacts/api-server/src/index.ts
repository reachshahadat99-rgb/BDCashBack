import app from "./app";
import { logger } from "./lib/logger";
import { releaseMatureCashback } from "./lib/orders";
import { processExpiredGroupBuyCampaigns } from "./lib/group-buy-processor";
import { runStartupMigrations } from "./lib/startup-migrations";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// listen() is called immediately so Hostinger's 3-second timeout is satisfied.
// Migrations and schedulers run inside the callback after the port is bound.
app.listen(port, () => {
  logger.info({ port }, "Server listening");

  // Run schema migrations right after bind — fast on an existing DB, creates
  // missing tables on a fresh deployment. Exit on failure so Hostinger
  // restarts the process rather than silently serving broken auth.
  runStartupMigrations()
    .then(() => {
      // -----------------------------------------------------------------------
      // Cashback release scheduler
      // Run once shortly after startup, then every hour, to transition
      // "delivered" orders past the 30-day return window into "completed"
      // and release cashback.
      // -----------------------------------------------------------------------
      const runRelease = () => {
        releaseMatureCashback()
          .then((count) => {
            if (count > 0) logger.info({ count }, "Released mature cashback");
          })
          .catch((err) => {
            logger.error({ err }, "Failed to release mature cashback");
          });
      };

      setTimeout(runRelease, 10_000);
      setInterval(runRelease, 60 * 60 * 1_000);

      // -----------------------------------------------------------------------
      // Group Buy settlement scheduler
      // Runs shortly after startup and every 15 minutes to settle expired
      // campaigns: refund deposits on failure, collect balance + cashback on
      // success.
      // -----------------------------------------------------------------------
      const runGroupBuySettlement = () => {
        processExpiredGroupBuyCampaigns()
          .then((count) => {
            if (count > 0)
              logger.info({ count }, "Settled expired group buy campaigns");
          })
          .catch((err) => {
            logger.error({ err }, "Failed to settle group buy campaigns");
          });
      };

      setTimeout(runGroupBuySettlement, 15_000);
      setInterval(runGroupBuySettlement, 15 * 60 * 1_000);
    })
    .catch((err) => {
      logger.error({ err }, "Startup migration failed — exiting");
      process.exit(1);
    });
});
