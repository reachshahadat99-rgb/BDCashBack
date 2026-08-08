/**
 * AuthContext — replaces Clerk with email/password + JWT stored in localStorage.
 *
 * Exports drop-in hooks compatible with the Clerk API surface used in this app:
 *   useAuth()   → { isLoaded, isSignedIn, userId, getToken }
 *   useUser()   → { isLoaded, user }
 *   useClerk()  → { signOut, addListener }
 *   useAuthContext() → full context value for login/register/logout
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TOKEN_KEY = "bdcashback_token";
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// Configure the API client base URL once (module level is fine — it's a singleton).
if (API_URL) setBaseUrl(API_URL);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  /** Called after user changes so callers (e.g. App) can react (e.g. clear query cache). */
  _onUserChange?: (userId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext<AuthContextValue>({
  isLoaded: false,
  isSignedIn: false,
  user: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({
  children,
  onUserChange,
}: {
  children: React.ReactNode;
  onUserChange?: (userId: string | null) => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Register JWT getter with the shared API client so every generated hook
  // automatically sends Authorization: Bearer <token>.
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setIsLoaded(true);
      return;
    }

    // Validate the stored token by fetching /auth/me.
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ user: AuthUser }>) : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setIsLoaded(true));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Login failed");
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      onUserChange?.(data.user.id);
    },
    [onUserChange],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, role = "customer") => {
      const r = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Registration failed");
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      onUserChange?.(data.user.id);
    },
    [onUserChange],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    onUserChange?.(null);
  }, [onUserChange]);

  return (
    <AuthContext.Provider
      value={{ isLoaded, isSignedIn: !!user, user, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Drop-in hooks — same API surface as the Clerk hooks used in this app
// ---------------------------------------------------------------------------

/** Full raw context — use in auth forms (login / register / logout). */
export function useAuthContext() {
  return useContext(AuthContext);
}

/** Matches Clerk's `useAuth()` shape used throughout this app. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  return {
    isLoaded: ctx.isLoaded,
    isSignedIn: ctx.isSignedIn,
    userId: ctx.user?.id ?? null,
    getToken: async () => localStorage.getItem(TOKEN_KEY),
  };
}

/** Matches Clerk's `useUser()` shape used throughout this app. */
export function useUser() {
  const ctx = useContext(AuthContext);
  const u = ctx.user;
  return {
    isLoaded: ctx.isLoaded,
    user: u
      ? {
          id: u.id,
          firstName: u.name.split(" ")[0] ?? "",
          lastName: u.name.split(" ").slice(1).join(" "),
          emailAddresses: [{ emailAddress: u.email }],
        }
      : null,
  };
}

/** Matches Clerk's `useClerk()` shape used throughout this app. */
export function useClerk() {
  const ctx = useContext(AuthContext);
  return {
    signOut: (opts?: { redirectUrl?: string }) => {
      ctx.logout();
      window.location.href = opts?.redirectUrl ?? "/";
    },
    /** Stub — React state changes handle re-renders without a listener bus. */
    addListener: (_fn: (data: { user: { id: string } | null }) => void) => {
      return () => {};
    },
  };
}
