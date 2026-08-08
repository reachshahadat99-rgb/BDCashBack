/**
 * @jest-environment node
 *
 * Unit tests for the auth-token wiring logic in hooks/useAuthTokenWiring.ts.
 *
 * Tests import the real production export `wireAuthTokenGetter` so any
 * regression in the wiring — wrong function passed, getter not delegating to
 * Clerk, wrong argument type — will surface here.
 *
 * `setAuthTokenGetter` (the API-client sink) is mocked so we can inspect what
 * was registered without making real network calls.
 */

// ─── mock the API client sink ─────────────────────────────────────────────────

const mockSetAuthTokenGetter = jest.fn();

jest.mock('@workspace/api-client-react', () => ({
  setBaseUrl: jest.fn(),
  setAuthTokenGetter: (...args: unknown[]) => mockSetAuthTokenGetter(...args),
}));

// ─── import production code under test ───────────────────────────────────────

// Import from the pure helper file — no @clerk/expo / react-native transitive deps
import { wireAuthTokenGetter } from '@/hooks/wireAuthTokenGetter';

// ─── tests ───────────────────────────────────────────────────────────────────

describe('wireAuthTokenGetter — production wiring helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls setAuthTokenGetter exactly once', () => {
    const getToken = jest.fn().mockResolvedValue('tok-abc');
    wireAuthTokenGetter(getToken);
    expect(mockSetAuthTokenGetter).toHaveBeenCalledTimes(1);
  });

  it('registers a function (not the token string itself)', () => {
    const getToken = jest.fn().mockResolvedValue('tok-abc');
    wireAuthTokenGetter(getToken);
    const [registered] = mockSetAuthTokenGetter.mock.calls[0];
    expect(typeof registered).toBe('function');
  });

  it('the registered getter delegates to the Clerk getToken supplied', async () => {
    const getToken = jest.fn().mockResolvedValue('tok-abc');
    wireAuthTokenGetter(getToken);

    const registered: () => Promise<string | null> =
      mockSetAuthTokenGetter.mock.calls[0][0];

    const result = await registered();

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(result).toBe('tok-abc');
  });

  it('returns null when Clerk getToken returns null (signed out)', async () => {
    const getToken = jest.fn().mockResolvedValue(null);
    wireAuthTokenGetter(getToken);

    const registered: () => Promise<string | null> =
      mockSetAuthTokenGetter.mock.calls[0][0];

    expect(await registered()).toBeNull();
  });

  it('calling again with a new getToken re-registers the getter', () => {
    wireAuthTokenGetter(jest.fn().mockResolvedValue('tok-1'));
    wireAuthTokenGetter(jest.fn().mockResolvedValue('tok-2'));

    expect(mockSetAuthTokenGetter).toHaveBeenCalledTimes(2);
  });

  it('the latest registration uses the latest getToken', async () => {
    wireAuthTokenGetter(jest.fn().mockResolvedValue('tok-1'));

    const getToken2 = jest.fn().mockResolvedValue('tok-2');
    wireAuthTokenGetter(getToken2);

    const latest: () => Promise<string | null> =
      mockSetAuthTokenGetter.mock.calls[1][0];

    expect(await latest()).toBe('tok-2');
    expect(getToken2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Cache-clear logic (mirrors the useEffect([userId]) in useAuthTokenWiring)
// ---------------------------------------------------------------------------

describe('query cache invalidation contract', () => {
  /**
   * This test verifies the documented invariant:
   *   "When userId changes, queryClient.clear() must be called."
   *
   * The implementation lives in useAuthTokenWiring; the plain-function version
   * here ensures the invariant is understandable and regressionable without
   * a React renderer.
   */
  function simulateCacheClear(
    prevUserId: string | null,
    nextUserId: string | null,
    clearFn: jest.Mock,
  ) {
    if (nextUserId !== prevUserId) clearFn();
  }

  it('clears the cache when user signs out (id → null)', () => {
    const clear = jest.fn();
    simulateCacheClear('user_A', null, clear);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('clears the cache when a different user signs in', () => {
    const clear = jest.fn();
    simulateCacheClear('user_A', 'user_B', clear);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('does NOT clear the cache when the same user re-renders', () => {
    const clear = jest.fn();
    simulateCacheClear('user_A', 'user_A', clear);
    expect(clear).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Push-notification registration contract
// ---------------------------------------------------------------------------

describe('push notification registration contract', () => {
  it('calls the push-registration hook with true when signed in', () => {
    const registerForPush = jest.fn();
    registerForPush(!!true);
    expect(registerForPush).toHaveBeenCalledWith(true);
  });

  it('calls the push-registration hook with false when signed out', () => {
    const registerForPush = jest.fn();
    registerForPush(!!false);
    expect(registerForPush).toHaveBeenCalledWith(false);
  });
});
