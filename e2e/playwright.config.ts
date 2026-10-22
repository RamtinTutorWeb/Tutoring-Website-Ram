import { defineConfig } from "@playwright/test";

/**
 * End-to-end suite: real backend + real local Supabase (Postgres + Storage) + the Vite app,
 * signed in through the local-only DEV_AUTH mode (no Clerk). Run with `npm run e2e`
 * after `supabase start`; it resets the local database first.
 */
const API_PORT = 4100;
const WEB_PORT = 5180;

// The Supabase CLI's documented local demo service-role key (see supabase/README.md). Local only.
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const E2E = {
  api: `http://localhost:${API_PORT}`,
  web: `http://localhost:${WEB_PORT}`,
  calendlyKey: "e2e-calendly-signing-key"
};

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: E2E.web,
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "npx tsx src/server.ts",
      cwd: "../backend",
      url: `${E2E.api}/health`,
      reuseExistingServer: false,
      env: {
        NODE_ENV: "development",
        PORT: String(API_PORT),
        DEV_AUTH: "1",
        CLERK_PUBLISHABLE_KEY: "",
        CLERK_SECRET_KEY: "",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY,
        FRONTEND_URL: E2E.web,
        CALENDLY_WEBHOOK_SIGNING_KEY: E2E.calendlyKey,
        RESEND_API_KEY: "",
        TURNSTILE_SECRET_KEY: ""
      }
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: "../frontend",
      url: E2E.web,
      reuseExistingServer: false,
      env: {
        VITE_DEV_AUTH: "1",
        VITE_API_URL: E2E.api,
        VITE_CLERK_PUBLISHABLE_KEY: "",
        VITE_CALENDLY_URL: "",
        VITE_TURNSTILE_SITE_KEY: ""
      }
    }
  ]
});
