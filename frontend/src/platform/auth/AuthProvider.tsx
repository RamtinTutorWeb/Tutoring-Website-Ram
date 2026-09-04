import { ClerkProvider, useAuth } from "@clerk/react";
import type { ReactNode } from "react";
import { SupabaseProvider } from "../db";
import { clerkPublishableKey, isClerkConfigured } from "../config";
import { ClerkAuthAdapter } from "./ClerkAuthAdapter";
import { MockAuthProvider } from "./MockAuthProvider";

/**
 * Outermost platform provider. Picks the auth backend from env:
 *
 * - `VITE_CLERK_PUBLISHABLE_KEY` set  -> Clerk (+ Supabase using Clerk's session token)
 * - not set                           -> dev-only MockAuthProvider (+ Supabase as anon)
 *
 * Additive by design: the legacy AppContext auth keeps working underneath
 * either branch until the migration flips consumers over to `useAuthUser`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!isClerkConfigured) {
    return (
      <MockAuthProvider>
        <SupabaseProvider getToken={getNullToken}>{children}</SupabaseProvider>
      </MockAuthProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
      <ClerkAuthAdapter>
        <ClerkSupabaseBridge>{children}</ClerkSupabaseBridge>
      </ClerkAuthAdapter>
    </ClerkProvider>
  );
}

async function getNullToken(): Promise<string | null> {
  return null;
}

/** Feeds Clerk's session token into Supabase (native Clerk integration, no JWT template). */
function ClerkSupabaseBridge({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  return <SupabaseProvider getToken={() => getToken()}>{children}</SupabaseProvider>;
}
