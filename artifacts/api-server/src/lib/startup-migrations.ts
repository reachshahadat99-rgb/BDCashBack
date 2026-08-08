/**
 * Startup migrations — run once on every server boot before accepting traffic.
 * Uses raw SQL with IF NOT EXISTS so it is safe to run against any database
 * state and will never destroy existing data.
 *
 * This is intentionally simple: no migration-tracking table, no versioning.
 * Each statement is idempotent. Add new ones at the bottom as the schema grows.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export async function runStartupMigrations(): Promise<void> {
  try {
    // ------------------------------------------------------------------
    // users — platform identity table (replaces Clerk-managed users).
    // Matches lib/db/src/schema/auth.ts exactly.
    // ------------------------------------------------------------------
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"            text        PRIMARY KEY,
        "email"         text        NOT NULL,
        "password_hash" text        NOT NULL,
        "name"          text        NOT NULL,
        "role"          text        NOT NULL DEFAULT 'customer',
        "created_at"    timestamptz NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique"
        ON "users" ("email")
    `);

    logger.info("Startup migrations complete");
  } catch (err) {
    // Log and rethrow — a missing schema is fatal; don't start a broken server.
    logger.error({ err }, "Startup migration failed");
    throw err;
  }
}
