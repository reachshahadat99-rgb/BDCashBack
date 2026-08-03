import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";

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
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
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
