/** Public build-time config (see frontend/.env.example and docs/ARCHITECTURE.md). */

function readEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

export const clerkPublishableKey = readEnv(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
export const isClerkConfigured = clerkPublishableKey.length > 0;

/** Backend origin. Falls back to the local backend in dev so `npm run dev` works without a .env. */
export const apiUrl = (readEnv(import.meta.env.VITE_API_URL) || (import.meta.env.DEV ? "http://localhost:4000" : "")).replace(/\/+$/, "");

/** Fallback booking link; the admin-set `pages.booking.calendlyUrl` takes precedence. */
export const envCalendlyUrl = readEnv(import.meta.env.VITE_CALENDLY_URL);
