import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthAdapterContext } from "./AuthAdapterContext";
import { toAuthRole, type AuthRole, type AuthUser } from "./types";

/**
 * DEV-ONLY mock auth adapter.
 *
 * Used when `VITE_CLERK_PUBLISHABLE_KEY` is not set so the Clerk-shaped
 * pages (/sign-in, /sign-up, /book, ProtectedRoute) can be exercised locally
 * without a Clerk account. It performs NO real authentication: anyone can
 * "sign in" as any email with any role. Never ship a build that relies on it.
 */

export const MOCK_AUTH_STORAGE_KEY = "tutorpro_mock_auth";

export interface MockAuthUser {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
}

export interface MockAuthContextValue {
  user: MockAuthUser | null;
  signIn: (email: string, role: AuthRole) => void;
  signOut: () => void;
}

const MockAuthContext = createContext<MockAuthContextValue | null>(null);

function readStoredUser(): MockAuthUser | null {
  try {
    const raw = localStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.email !== "string") return null;
    return {
      id: record.id,
      email: record.email,
      fullName: typeof record.fullName === "string" ? record.fullName : record.email,
      role: toAuthRole(record.role)
    };
  } catch {
    return null;
  }
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || email;
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockAuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setUser(readStoredUser());
    setIsLoaded(true);
  }, []);

  const signIn = useCallback((email: string, role: AuthRole) => {
    const normalizedEmail = email.trim().toLowerCase();
    const next: MockAuthUser = {
      id: `mock_${normalizedEmail.replace(/[^a-z0-9]+/g, "_")}`,
      email: normalizedEmail,
      fullName: nameFromEmail(normalizedEmail),
      role
    };
    localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
    setUser(null);
  }, []);

  const mockValue = useMemo<MockAuthContextValue>(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  const adapterValue = useMemo<AuthUser>(
    () => ({
      isLoaded,
      isSignedIn: user !== null,
      userId: user?.id ?? null,
      email: user?.email ?? null,
      fullName: user?.fullName ?? null,
      role: user?.role ?? null,
      signOut: async () => {
        signOut();
      },
      // The mock has no session token; Supabase calls run as `anon`.
      getToken: async () => null
    }),
    [isLoaded, user, signOut]
  );

  return (
    <MockAuthContext.Provider value={mockValue}>
      <AuthAdapterContext.Provider value={adapterValue}>{children}</AuthAdapterContext.Provider>
    </MockAuthContext.Provider>
  );
}

export function useMockAuth(): MockAuthContextValue {
  const value = useContext(MockAuthContext);
  if (!value) {
    throw new Error("useMockAuth must be used inside <MockAuthProvider> (legacy/mock mode only).");
  }
  return value;
}
