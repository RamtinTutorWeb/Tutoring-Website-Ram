/**
 * Platform configuration read from Vite env vars (see frontend/.env.example).
 *
 * Everything here is optional. With no env vars set the app runs in
 * `legacy` mode and behaves exactly as before the platform foundation
 * was added (homegrown JWT auth against the Express backend).
 */

function readEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

export const clerkPublishableKey: string = readEnv(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
export const supabaseUrl: string = readEnv(import.meta.env.VITE_SUPABASE_URL);
export const supabaseAnonKey: string = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);
export const calendlyUrl: string = readEnv(import.meta.env.VITE_CALENDLY_URL);
/** Legacy Express backend. Still used by AppContext until the Supabase cutover. */
export const legacyBackendUrl: string = readEnv(import.meta.env.VITE_BACKEND_URL);

export const isClerkConfigured: boolean = clerkPublishableKey.length > 0;
export const isCalendlyConfigured: boolean = calendlyUrl.length > 0;

export type PlatformMode = "legacy" | "clerk";

/** `clerk` when a Clerk publishable key is present, otherwise `legacy`. */
export const platformMode: PlatformMode = isClerkConfigured ? "clerk" : "legacy";
