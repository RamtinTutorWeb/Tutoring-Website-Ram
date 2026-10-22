import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { TokenGetter } from "../api/client";
import { clerkPublishableKey, isClerkConfigured, isDevAuth } from "../config";

/**
 * App-facing view of the Clerk session. Components read this instead of Clerk hooks so public
 * pages still render when `VITE_CLERK_PUBLISHABLE_KEY` is missing (Clerk hooks throw outside
 * <ClerkProvider>). Role is NOT here: it comes from `GET /me` (see api/MeProvider).
 */
export interface Session {
  /** False when no Clerk publishable key is configured; auth routes show a config error. */
  configured: boolean;
  /** "dev" = local dev sign-in (see config.isDevAuth); Clerk components must not render then. */
  mode: "clerk" | "dev" | "none";
  /** Dev mode only: sign in as a seeded dev user (`user_dev_admin`, `user_dev_student`). */
  devSignIn?: (userId: string) => void;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  fullName: string | null;
  email: string | null;
  getToken: TokenGetter;
  signOut: () => Promise<void>;
  openUserProfile: () => void;
}

const unconfiguredSession: Session = {
  configured: false,
  mode: "none",
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  fullName: null,
  email: null,
  getToken: async () => null,
  signOut: async () => undefined,
  openUserProfile: () => undefined
};

const SessionContext = createContext<Session>(unconfiguredSession);

export function useSession(): Session {
  return useContext(SessionContext);
}

/** Must render inside <BrowserRouter> so Clerk navigates with React Router. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  // `import.meta.env.DEV` inline so production builds drop the dev provider entirely.
  if (import.meta.env.DEV && isDevAuth) return <DevSessionProvider>{children}</DevSessionProvider>;

  if (!isClerkConfigured) {
    return <SessionContext.Provider value={unconfiguredSession}>{children}</SessionContext.Provider>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      afterSignOutUrl="/"
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      <ClerkSessionBridge>{children}</ClerkSessionBridge>
    </ClerkProvider>
  );
}

function ClerkSessionBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  // Keep the token getter identity stable so API hooks don't refetch on every Clerk render.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);
  const stableGetToken = useCallback<TokenGetter>(() => getTokenRef.current(), []);

  const value = useMemo<Session>(
    () => ({
      configured: true,
      mode: "clerk" as const,
      isLoaded,
      isSignedIn: isSignedIn === true,
      userId: userId ?? null,
      fullName: user?.fullName ?? null,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      getToken: stableGetToken,
      signOut: () => clerk.signOut(),
      openUserProfile: () => clerk.openUserProfile()
    }),
    [isLoaded, isSignedIn, userId, user, stableGetToken, clerk]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

const DEV_USER_KEY = "tutorpro.devUser";

function readDevUser(): string | null {
  try {
    return localStorage.getItem(DEV_USER_KEY);
  } catch {
    return null;
  }
}

/** Local dev sign-in: the "token" is `dev:<userId>`, which only a DEV_AUTH backend accepts. */
function DevSessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(readDevUser);

  const persist = useCallback((next: string | null) => {
    try {
      if (next) localStorage.setItem(DEV_USER_KEY, next);
      else localStorage.removeItem(DEV_USER_KEY);
    } catch {
      // Private mode: the dev session just won't survive a reload.
    }
    setUserId(next);
  }, []);

  const getToken = useCallback<TokenGetter>(async () => (userId ? `dev:${userId}` : null), [userId]);

  const value = useMemo<Session>(() => ({
    configured: true,
    mode: "dev",
    isLoaded: true,
    isSignedIn: userId !== null,
    userId,
    fullName: null,
    email: null,
    getToken,
    signOut: async () => persist(null),
    openUserProfile: () => undefined,
    devSignIn: (next: string) => persist(next)
  }), [userId, getToken, persist]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
