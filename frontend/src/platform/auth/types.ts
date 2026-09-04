export type AuthRole = "student" | "admin";

/**
 * Provider-agnostic view of the signed-in user. Components consume this
 * shape (via `useAuthUser`) and never import `@clerk/react` directly, so
 * the auth backend can be swapped without touching UI code.
 */
export interface AuthUser {
  /** False until the auth provider has finished restoring the session. */
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  role: AuthRole | null;
  signOut: () => Promise<void>;
  /** Session token for Supabase / API calls. Null when signed out. */
  getToken: () => Promise<string | null>;
}

export const AUTH_ROLES: readonly AuthRole[] = ["student", "admin"];

export function toAuthRole(value: unknown): AuthRole {
  return value === "admin" ? "admin" : "student";
}
