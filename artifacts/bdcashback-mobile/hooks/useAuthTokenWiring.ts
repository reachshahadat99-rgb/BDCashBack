/**
 * Auth-token wiring logic, extracted from the root layout for testability.
 *
 * `wireAuthTokenGetter` is a pure function that can be imported and exercised
 * by Jest tests without a React renderer.  `useAuthTokenWiring` is the hook
 * that calls it inside the correct React effect.
 */

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/expo';
import type { QueryClient } from '@tanstack/react-query';
import { usePushNotifications } from './usePushNotifications';
import { wireAuthTokenGetter } from './wireAuthTokenGetter';

export { wireAuthTokenGetter };

// ---------------------------------------------------------------------------
// React hook used by the root layout
// ---------------------------------------------------------------------------

/**
 * Wires the Clerk bearer token into the API client and clears the query cache
 * whenever the signed-in user identity changes.
 *
 * @param queryClient - The app-level QueryClient (passed in so the layout
 *   keeps ownership of the singleton).
 */
export function useAuthTokenWiring(queryClient: QueryClient): void {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();

  // Wire bearer token on every getToken reference change (e.g. after sign-in).
  // wireAuthTokenGetter is imported from a separate file with no native deps.
  useEffect(() => {
    wireAuthTokenGetter(getToken);
  }, [getToken]);

  // Clear ALL cached queries when user identity changes to prevent stale data
  // leaking between sessions.
  const userId = user?.id ?? null;
  useEffect(() => {
    queryClient.clear();
  }, [userId, queryClient]);

  // Register for push notifications when signed in
  usePushNotifications(!!isSignedIn);
}
