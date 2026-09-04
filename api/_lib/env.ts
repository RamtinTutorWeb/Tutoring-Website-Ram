/**
 * Server-side environment accessors for Vercel functions.
 *
 * Every getter reads `process.env` lazily so a missing variable only fails the
 * request that needs it (and `api/health` can report what is configured).
 * Never log the returned values.
 */

export class MissingEnvError extends Error {
  readonly envName: string;

  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
    this.name = 'MissingEnvError';
    this.envName = name;
  }
}

/** Returns the trimmed value of `name`, or throws `MissingEnvError`. */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new MissingEnvError(name);
  }
  return value;
}

/** Returns the trimmed value of `name`, or `undefined` when unset/blank. */
export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** True when `name` is set to a non-blank value. Safe to expose (no values). */
export function hasEnv(name: string): boolean {
  return optionalEnv(name) !== undefined;
}

// --- Clerk ------------------------------------------------------------------

export const getClerkSecretKey = (): string => requireEnv('CLERK_SECRET_KEY');
export const getClerkWebhookSigningSecret = (): string => requireEnv('CLERK_WEBHOOK_SIGNING_SECRET');

// --- Supabase ---------------------------------------------------------------

export const getSupabaseUrl = (): string => requireEnv('SUPABASE_URL');
export const getSupabaseServiceRoleKey = (): string => requireEnv('SUPABASE_SERVICE_ROLE_KEY');

// --- Calendly ---------------------------------------------------------------

export const getCalendlyWebhookSigningKey = (): string => requireEnv('CALENDLY_WEBHOOK_SIGNING_KEY');
/** Optional: only needed by `api/calendly/register-webhook`. */
export const getCalendlyPersonalAccessToken = (): string | undefined =>
  optionalEnv('CALENDLY_PERSONAL_ACCESS_TOKEN');

// --- Admin / deployment -----------------------------------------------------

/** Shared secret for admin-only maintenance endpoints (`x-admin-token` header). */
export const getAdminApiToken = (): string => requireEnv('ADMIN_API_TOKEN');

/** Public origin of this deployment, e.g. `https://tutorpro.example.com` (no trailing slash). */
export const getPublicBaseUrl = (): string => requireEnv('PUBLIC_BASE_URL').replace(/\/+$/, '');

// --- Presence summary (for /api/health) --------------------------------------

export interface ConfiguredSummary {
  clerk: boolean;
  supabase: boolean;
  calendly: boolean;
}

/** Reports which integrations have all their required variables set. Booleans only. */
export function getConfiguredSummary(): ConfiguredSummary {
  return {
    clerk: hasEnv('CLERK_SECRET_KEY') && hasEnv('CLERK_WEBHOOK_SIGNING_SECRET'),
    supabase: hasEnv('SUPABASE_URL') && hasEnv('SUPABASE_SERVICE_ROLE_KEY'),
    calendly: hasEnv('CALENDLY_WEBHOOK_SIGNING_KEY'),
  };
}
