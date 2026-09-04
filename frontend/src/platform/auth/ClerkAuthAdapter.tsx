import { useAuth, useUser } from "@clerk/react";
import { useMemo, type ReactNode } from "react";
import { AuthAdapterContext } from "./AuthAdapterContext";
import { toAuthRole, type AuthUser } from "./types";

/**
 * Maps Clerk's `useAuth` / `useUser` into the normalized `AuthUser` shape.
 * Must be rendered inside `<ClerkProvider>`. Role comes from
 * `user.publicMetadata.role` (set via the Clerk Backend API / dashboard) and
 * defaults to `student`.
 */
export function ClerkAuthAdapter({ children }: { children: ReactNode }) {
  const { isLoaded: authLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();

  const value = useMemo<AuthUser>(() => {
    const signedIn = isSignedIn === true;
    const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
    return {
      isLoaded: authLoaded && userLoaded,
      isSignedIn: signedIn,
      userId: userId ?? null,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      fullName: user?.fullName ?? null,
      role: signedIn ? toAuthRole(metadata.role) : null,
      signOut: async () => {
        await signOut();
      },
      // Clerk's native Supabase integration: plain session token, no JWT template.
      getToken: () => getToken()
    };
  }, [authLoaded, userLoaded, isSignedIn, userId, user, getToken, signOut]);

  return <AuthAdapterContext.Provider value={value}>{children}</AuthAdapterContext.Provider>;
}
