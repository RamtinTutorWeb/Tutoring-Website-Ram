# Handoff prompt for the wiring machine

Copy everything below the line into the agent on the other computer.

---

You are wiring up the TutorPro platform migration. The foundation is already built and pushed. Your job is to create the accounts, fill in the env vars, apply the schema, deploy, and then cut the app over from the legacy Express/Mongo backend to Supabase + Clerk + Calendly on Vercel.

Repo: https://github.com/Shahla92500/Tutoring-Website-Ram
Branch: `feat/platform-foundation` (check it out; if it has been merged, use `main`).

Read these first, in order:
1. `README.md` — what the product is and who uses it.
2. `MIGRATION.md` — the step-by-step runbook. Follow it in order. Every step names the env var it produces.
3. `supabase/README.md` — how to apply the schema and enable Clerk third-party auth.
4. `frontend/src/platform/` — the new auth, db, and booking layer. `useAuthUser()` is the only auth hook components should use. `useSupabase()` returns a typed client or null.
5. `api/` — Vercel serverless functions: Clerk webhook, Calendly webhook, health check, Calendly webhook registration helper.

What already exists and works with zero env vars set:
- The app runs in legacy mode (JWT + Express) exactly as before. Nothing is broken.
- With no `VITE_CLERK_PUBLISHABLE_KEY`, `/sign-in` and `/sign-up` render a dev mock auth form. `/book` shows a "not configured" card.
- Supabase schema with RLS keyed to Clerk user ids is in `supabase/migrations/`. Seed data in `supabase/seed.sql`.
- `vercel.json` deploys the Vite SPA plus `api/` functions.
- `npm run typecheck:api` and `cd frontend && npx vite build` pass.

Phase 1, accounts (do with the human, they own the accounts):
- Supabase project → apply migration, enable Third-party auth → Clerk.
- Clerk app → Email + Google, activate the Supabase integration, set `publicMetadata.role = "admin"` on the owner's user, create the webhook endpoint for user.created/updated/deleted.
- Calendly → one event type per session length, copy the scheduling link, create a Personal Access Token, get the webhook signing key. Webhooks need a paid Calendly plan; confirm the plan before relying on booking sync.
- Vercel → import the repo, root directory = repo root, add every env var from the table at the top of `MIGRATION.md`, deploy. Then set `PUBLIC_BASE_URL` and register the Calendly webhook (`POST /api/calendly/register-webhook` with the `x-admin-token` header, curl example is in MIGRATION.md).
- Verify: `GET /api/health` shows all three configured. Sign up via Clerk, confirm a `profiles` row appears. Book a test Calendly slot, confirm a `bookings` row appears.

Phase 2, cutover (work through the table in `MIGRATION.md` section 6, one row at a time, in a worktree, small PRs):
1. Replace the legacy `/login` flow with `/sign-in` and `/sign-up`. Point the header Login link at `/sign-in`, mount `UserMenu` from `platform/auth` in the header.
2. Move `AppContext` off the Express `/settings` sync and `localStorage` mirror onto `platform/db/queries.ts` (site settings, session requests, learner courses, bookings).
3. Replace the dashboard's slot calendar with the `bookings` table and a "Book" button that links to `/book?request=<id>`.
4. Retire `backend/`, `netlify.toml`, the `mongodb` root dependency, and `VITE_BACKEND_URL` last, after every row is done.

Decisions to confirm with the human before Phase 2 (listed in `MIGRATION.md` section 7): keep the assessment feature or drop it; keep the in-app content editor or hardcode content; keep the session request form as a triage step before Calendly, or let students book directly.

Rules:
- Never commit secrets. `.env`, `.env.local`, and `frontend/.env*` are git-ignored; keep it that way.
- Never put a secret in a `VITE_` variable.
- Do not run `git checkout -b` or `git switch` in the shared checkout. Use `git worktree add`.
- Keep the legacy backend running until the cutover table is complete.
- Update `MIGRATION.md` status column as rows complete.
