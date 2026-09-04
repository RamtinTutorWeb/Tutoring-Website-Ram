# Supabase (Postgres) for TutorPro

This folder holds the database schema for the Supabase migration. Identity comes from **Clerk**, not Supabase Auth; Supabase only stores data and enforces row-level security (RLS) against Clerk-issued JWTs.

```
supabase/
├── migrations/
│   └── 20260903000000_init.sql   schema, RLS, grants
├── seed.sql                       local dev data (never for production)
└── README.md
```

`supabase init` is **not** needed. The migrations directory is already laid out the way the CLI expects. The CLI will create `config.toml` on first `supabase start` if it is missing.

## Apply to a hosted project

Prerequisites: [Supabase CLI](https://supabase.com/docs/guides/cli) and a project created in the dashboard.

```bash
# from the repo root
supabase login
supabase link --project-ref <your-project-ref>
supabase db push            # applies every file in supabase/migrations
```

No CLI? Open the dashboard **SQL Editor**, paste the contents of `migrations/20260903000000_init.sql`, and run it. The file is safe to re-run.

Do **not** run `seed.sql` against a hosted project. It inserts placeholder profile ids that are not real Clerk users.

## Run locally

Requires Docker.

```bash
supabase start              # starts Postgres, PostgREST, Studio; applies migrations + seed.sql
supabase status             # prints API URL, anon key, service_role key, Studio URL
supabase db reset           # drop, re-migrate, re-seed
supabase stop
```

Put the printed values into `frontend/.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase status>
```

The frontend treats Supabase as disabled until both variables are set, so the current Express/Mongo app keeps working unchanged.

## Enable Clerk as the auth provider

Supabase must be told to accept Clerk session tokens. Once configured, `auth.jwt()->>'sub'` in Postgres is the Clerk user id and `auth.jwt()->>'role'` is `authenticated`.

1. **Clerk dashboard**: open *Configure* (or *Integrations*) and enable the **Supabase** integration. Copy the Clerk domain it shows, e.g. `your-app.clerk.accounts.dev` or `clerk.yourdomain.com`.
2. **Supabase dashboard**: *Authentication* > *Sign In / Providers* > *Third-party auth* > *Add provider* > **Clerk**. Paste that domain.
3. **Local dev**: add the same to `supabase/config.toml`:

   ```toml
   [auth.third_party.clerk]
   enabled = true
   domain = "your-app.clerk.accounts.dev"
   ```

4. **Frontend**: the client in `frontend/src/platform/db/client.ts` is created with supabase-js's `accessToken` option, which calls Clerk's `getToken()` for every request. No Supabase Auth session is ever created.

Webhook handlers (Clerk `user.*`, Calendly `invitee.*`) run server-side with the **service_role** key. That key bypasses RLS, so keep it out of the frontend bundle and out of any `VITE_*` variable.

## Tables

| Table | Purpose | Who can read | Who can write |
|---|---|---|---|
| `profiles` | One row per Clerk user. `id` is the Clerk user id. `role` is `student` or `admin`. | Own row; admin all | Own row (cannot change `role`; self-insert forced to `student`); admin all. Clerk webhook via service role. |
| `site_settings` | Key/value JSON blobs edited from the admin settings page. Keys: `content`, `selectable_options`, `session_settings`. | Anyone, including anonymous visitors | Admin insert/update |
| `session_requests` | A student's tutoring request: subject, urgency, hard topics, preferred slot. `status`: `open`, `accepted`, `declined`, `scheduled`. | Own rows; admin all | Student inserts own; admin all |
| `bookings` | Mirror of Calendly scheduled events, linked to a student by invitee email and optionally to a request. `status`: `scheduled`, `canceled`. | Own rows; admin all | Calendly webhook via service role; admin all |
| `assessments` | Placement questionnaire and test answers with a score. | Own rows; admin all | Student inserts own; admin all |
| `learner_courses` | Courses an admin assigned to a student, with progress (`registered`, `in-progress`, `passed`). Unique per student and course. | Own rows; admin all | Admin only |
| `webhook_events` | Idempotency ledger keyed on `(provider, event_id)` for Clerk and Calendly webhooks. | Service role only | Service role only |

Helper functions:

- `public.clerk_user_id()` returns the `sub` claim of the current JWT, or null.
- `public.is_admin()` returns true when the caller's profile has `role = 'admin'`. It is `security definer` so the check is not blocked by RLS on `profiles`.
- `public.set_updated_at()` trigger keeps `updated_at` current on every table that has the column.

## Adding a migration

```bash
supabase migration new <short_name>     # creates supabase/migrations/<timestamp>_<short_name>.sql
supabase db push                        # hosted
supabase db reset                       # local
```

After changing the schema, update the hand-written row types in `frontend/src/platform/db/types.ts`. Once a hosted project exists you can generate them instead:

```bash
supabase gen types typescript --linked > frontend/src/platform/db/database.generated.ts
```
