/**
 * Pure wiring helper — no React / native dependencies.
 * Imported by both useAuthTokenWiring (hook) and the Jest unit tests.
 */
import { setAuthTokenGetter } from '@workspace/api-client-react';

/**
 * Registers a token getter with the API client so every request includes a
 * Bearer token.  Wraps `getToken` in an arrow function so the registered
 * getter always captures the current reference.
 *
 * Exported for direct unit-testing without a React renderer.
 */
export function wireAuthTokenGetter(
  getToken: () => Promise<string | null>,
): void {
  setAuthTokenGetter(() => getToken());
}
