import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";

function jwtSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET env var is not set");
  return s;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: adminUsersTable.userId })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.userId, userId))
    .limit(1);
  return Boolean(row);
}

export async function adminCount(): Promise<number> {
  const rows = await db.select({ userId: adminUsersTable.userId }).from(adminUsersTable);
  return rows.length;
}

/** Requires a signed-in platform admin; sets res.locals.userId. */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = header.slice(7);
  let userId: string;
  try {
    const payload = jwt.verify(token, jwtSecret()) as { userId: string };
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  isAdmin(userId)
    .then((ok) => {
      if (!ok) {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      res.locals.userId = userId;
      next();
    })
    .catch(next);
};
