/**
 * Canonical authentication/authorisation middleware.
 *
 * Import `requireAuth` or `requireAdmin` from here instead of defining
 * local copies inside each route file.
 */

import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";

// Re-export admin helpers so callers only need one import.
export { requireAdmin, isAdmin, adminCount } from "../lib/admin";

/**
 * Ensure the request carries a valid Clerk session.
 * Populates `res.locals.userId` for downstream handlers.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.userId = userId;
  next();
};
