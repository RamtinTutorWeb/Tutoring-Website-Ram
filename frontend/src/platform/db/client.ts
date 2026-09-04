import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type TutorProSupabaseClient = SupabaseClient<Database>;

/** Returns the Clerk session token for the current user, or null when signed out. */
export type GetToken = () => Promise<string | null>;

const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True only when both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set. */
export const isSupabaseConfigured: boolean = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Creates a supabase-js client that authenticates every request with a Clerk
 * session token (Supabase third-party auth). Returns null when env vars are
 * missing so the legacy Express/Mongo path keeps working.
 */
export function createSupabaseClient(getToken: GetToken): TutorProSupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    accessToken: getToken
  });
}

let cachedClient: TutorProSupabaseClient | null = null;
let cachedGetToken: GetToken | null = null;

/**
 * Memoized singleton. Re-created only if a different `getToken` function is
 * passed, which happens when the auth provider remounts.
 */
export function getSupabaseClient(getToken: GetToken): TutorProSupabaseClient | null {
  if (!cachedClient || cachedGetToken !== getToken) {
    cachedClient = createSupabaseClient(getToken);
    cachedGetToken = getToken;
  }
  return cachedClient;
}

/** Holds the Clerk `getToken` function. Mounted by the auth layer. */
export const SupabaseTokenContext = createContext<GetToken | null>(null);

interface SupabaseProviderProps {
  getToken: GetToken;
  children?: ReactNode;
}

/**
 * Provides a `getToken` to descendants. Agent B mounts this inside ClerkProvider
 * with `useAuth().getToken`. Uses createElement so this file stays .ts.
 */
export function SupabaseProvider({ getToken, children }: SupabaseProviderProps) {
  return createElement(SupabaseTokenContext.Provider, { value: getToken }, children);
}

/**
 * Returns the shared client, or null when Supabase is not configured or no
 * SupabaseProvider is mounted above the caller. Callers must handle null.
 */
export function useSupabase(): TutorProSupabaseClient | null {
  const getToken = useContext(SupabaseTokenContext);
  return useMemo(() => (getToken ? getSupabaseClient(getToken) : null), [getToken]);
}
