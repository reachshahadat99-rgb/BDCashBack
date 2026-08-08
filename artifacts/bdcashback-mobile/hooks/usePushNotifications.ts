import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { customFetch } from '@workspace/api-client-react';

// Configure how notifications are shown while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers for push notifications, saves the Expo push token to the server,
 * and wires up a foreground notification listener.
 *
 * Call from the root layout, passing `isSignedIn` from Clerk so the token is
 * saved only for authenticated users.
 */
export function usePushNotifications(isSignedIn: boolean) {
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Push notifications are not supported on web
    if (!isSignedIn || Platform.OS === 'web') return;

    let cancelled = false;

    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted' || cancelled) return;

        // projectId is required for production push tokens; gracefully skip if
        // not configured so development builds still work without EAS.
        const tokenData = await Notifications.getExpoPushTokenAsync().catch(
          () => null,
        );
        if (!tokenData || cancelled) return;

        await customFetch('/push-token', {
          method: 'PUT',
          body: JSON.stringify({ token: tokenData.data }),
        });
      } catch (err) {
        // Non-fatal: push notifications may not work in development, but the
        // rest of the app continues normally.
        console.warn('[PushNotifications] Registration failed:', err);
      }
    })();

    // Listen for notifications received while the app is in the foreground
    listenerRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[PushNotifications] Foreground notification:', notification);
      },
    );

    return () => {
      cancelled = true;
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, [isSignedIn]);
}

/**
 * Schedule an immediate local notification. Works on iOS and Android; no-ops
 * on web where the API is unavailable.
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null, // fire immediately
    });
  } catch (err) {
    console.warn('[PushNotifications] scheduleLocalNotification failed:', err);
  }
}
