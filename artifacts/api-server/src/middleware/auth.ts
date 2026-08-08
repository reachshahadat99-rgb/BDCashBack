/**
 * Canonical authentication/authorisation middleware.
 *
 * Import `requireAuth` or `requireAdmin` from here instead of defining
 * local copies inside each route file.
 *
 * Auth is now JWT-based (Bearer token). The token is issued by /api/auth/login
 * and /api/auth/register and stored in the client's localStorage.
 */

import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

// Re-export admin helpers so callers only need one import.
export { requireAdmin, isAdmin, adminCount } from "../lib/admin";

function jwtSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET env var is not set");
  return s;
}

/**
 * Ensure the request carries a valid JWT Bearer token.
 * Populates `res.locals.userId` for downstream handlers.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret()) as { userId: string };
    res.locals.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
