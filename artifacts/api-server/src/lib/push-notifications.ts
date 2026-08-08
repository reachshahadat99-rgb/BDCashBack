import { db, userPushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Send an Expo push notification to a single user by their userId.
 * Looks up their stored Expo push token and POSTs to the Expo Push API.
 * Non-fatal: logs a warning on failure so the caller's flow is never broken.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const [row] = await db
      .select({ expoPushToken: userPushTokensTable.expoPushToken })
      .from(userPushTokensTable)
      .where(eq(userPushTokensTable.userId, userId))
      .limit(1);

    if (!row?.expoPushToken) return;

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to: row.expoPushToken,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(unreadable)");
      console.warn("[PushNotifications] Expo API error:", response.status, text);
    }
  } catch (err) {
    // Non-fatal: push notifications may not be available in all environments.
    console.warn("[PushNotifications] Failed to send push to user:", userId, err);
  }
}
