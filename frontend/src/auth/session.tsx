import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { TokenGetter } from "../api/client";
import { clerkPublishableKey, isClerkConfigured } from "../config";

/**
 * App-facing view of the Clerk session. Components read this instead of Clerk hooks so public
 * pages still render when `VITE_CLERK_PUBLISHABLE_KEY` is missing (Clerk hooks throw outside
 * <ClerkProvider>). Role is NOT here: it comes from `GET /me` (see api/MeProvider).
 */
export interface Session {
  /** False when no Clerk publishable key is configured; auth routes show a config error. */
  configured: boolean;
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
