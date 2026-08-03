import app from "./app";
import { logger } from "./lib/logger";
import { releaseMatureCashback } from "./lib/orders";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // ---------------------------------------------------------------------------
  // Cashback release scheduler
  // Run once shortly after startup, then every hour, to transition "delivered"
  // orders past the 30-day return window into "completed" and release cashback.
  // ---------------------------------------------------------------------------
  const runRelease = () => {
    releaseMatureCashback()
      .then((count) => {
        if (count > 0) {
          logger.info({ count }, "Released mature cashback");
        }
      })
      .catch((err) => {
        logger.error({ err }, "Failed to release mature cashback");
      });
  };

  // Initial run after a short delay to let the DB connection warm up
  setTimeout(runRelease, 10_000);

  // Subsequent runs every hour
  const HOUR_MS = 60 * 60 * 1_000;
  setInterval(runRelease, HOUR_MS);
});
