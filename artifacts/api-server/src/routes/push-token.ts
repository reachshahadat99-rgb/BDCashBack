import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth";
import { db, userPushTokensTable } from "@workspace/db";
import { SavePushTokenBody, SavePushTokenResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// PUT /push-token — upsert the caller's Expo push token
router.put("/push-token", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const body = SavePushTokenBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid push token" });
    return;
  }

  await db
    .insert(userPushTokensTable)
    .values({ userId, expoPushToken: body.data.token })
    .onConflictDoUpdate({
      target: userPushTokensTable.userId,
      set: {
        expoPushToken: body.data.token,
        updatedAt: new Date(),
      },
    });

  res.json(SavePushTokenResponse.parse({ ok: true }));
});

export default router;
