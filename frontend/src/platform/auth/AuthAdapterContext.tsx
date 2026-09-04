import { createContext, useContext } from "react";
import type { AuthUser } from "./types";

/**
 * Bridges whichever auth backend is active (Clerk or the dev mock) to the
 * normalized `AuthUser` shape. Only the adapters in this folder write to it;
 * everything else reads it through `useAuthUser()`.
 */
export const AuthAdapterContext = createContext<AuthUser | null>(null);

export function useAuthAdapter(): AuthUser {
  const value = useContext(AuthAdapterContext);
  if (!value) {
    throw new Error("useAuthUser must be used inside <AuthProvider>.");
  }
  return value;
}
