---
name: Drizzle wraps Postgres error codes
description: How to detect unique violations (23505) etc. when using drizzle-orm in this workspace
---

Drizzle (node-postgres driver) can wrap the original pg error in a `DrizzleQueryError`, so `error.code === "23505"` checks fail — the code lives on `error.cause`.

**Why:** A concurrency test caught a unique-violation handler that never fired because it only checked the top-level `code`; the duplicate-join path crashed instead of returning 409.

**How to apply:** When catching DB errors to detect constraint violations, walk the `cause` chain looking for `.code` (see `isUniqueViolation` in the group-buy route). Also remember a failed statement aborts the Postgres transaction — bail out of the `db.transaction` callback by throwing a sentinel, not by returning.
