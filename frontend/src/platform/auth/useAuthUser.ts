import { useAuthAdapter } from "./AuthAdapterContext";
import type { AuthUser } from "./types";

/**
 * Normalized auth hook that works in both Clerk and mock modes.
 *
 * Returns `{ isLoaded, isSignedIn, userId, email, fullName, role, signOut, getToken }`.
 * Components should use this instead of importing `@clerk/react`.
 */
export function useAuthUser(): AuthUser {
  return useAuthAdapter();
}
