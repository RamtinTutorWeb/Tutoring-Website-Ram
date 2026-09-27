# Supabase (Postgres) for TutorPro

Supabase is used as **Postgres only**. The browser never talks to it: the
Railway backend (`backend/`) is the only client and connects with the
**service-role** key. Identity comes from Clerk, not Supabase Auth.

RLS is enabled on every table with **no policies**, and `anon` / `authenticated`
hold no table privileges, so a leaked anon key can read or write nothing. The
service role bypasses RLS.

```
supabase/
├── config.toml                              local stack (Postgres + PostgREST + Studio only)
├── migrations/
│   ├── 20260903000000_init.sql              schema (its RLS policies are removed by the next file)
│   └── 20260927000000_backend_only.sql      contact-form requests, assessments.total/recommendation,
│                                            lock out anon/authenticated, default selectable options
├── seed.sql                                 local dev data (never for production)
└── README.md
```

## Apply to a hosted project

```bash
# from the repo root
supabase login
supabase link --project-ref <your-project-ref>
supabase db push            # applies every file in supabase/migrations, in order
```

No CLI? Paste each migration into the dashboard **SQL Editor** in filename order.
Both files are safe to re-run. Do **not** run `seed.sql` against a hosted project.

Then give the backend `SUPABASE_URL` (Project Settings > API > Project URL) and
`SUPABASE_SERVICE_ROLE_KEY` (the `service_role` / secret key). Nothing goes in
the frontend.

## Run locally

Requires Docker.

```bash
supabase start              # applies migrations + seed.sql
supabase db reset           # drop, re-migrate, re-seed
supabase stop
```

`config.toml` disables Supabase Auth, so `supabase status` does not print API
keys. Use the CLI's standard local demo service-role key (the JWT signed with the
default local secret `super-secret-jwt-token-with-at-least-32-characters-long`):

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

## Tables

All access goes through the backend; see `docs/ARCHITECTURE.md` for who can do what.

| Table | Purpose |
|---|---|
| `profiles` | One row per Clerk user (`id` = Clerk user id). `role` mirrors Clerk `publicMetadata.role`. Written by the Clerk webhook and `GET /me`. |
| `site_settings` | JSON blobs by key: `content` (courses, examPrepTracks, reviews, faq), `selectable_options` (dropdowns). `session_settings` is legacy and unused. |
| `session_requests` | Contact-form requests. `student_id` is null for guests. `status`: `new`, `accepted`, `declined`, `scheduled`, `closed`. |
| `bookings` | Mirror of Calendly invitees, keyed on `calendly_invitee_uri`; linked to a request via `utm_content`. `status`: `scheduled`, `canceled`. |
| `assessments` | Placement answers with `score`, `total`, `recommendation`. |
| `learner_courses` | A student's courses with progress (`registered`, `in-progress`, `passed`). Unique per student and course. |
| `webhook_events` | Idempotency ledger keyed on `(provider, event_id)` for Clerk and Calendly. |

## Adding a migration

```bash
supabase migration new <short_name>     # supabase/migrations/<timestamp>_<short_name>.sql
supabase db reset                       # local
supabase db push                        # hosted
```

New tables get no `anon`/`authenticated` privileges by default (the
backend-only migration revokes the default grants). Enable RLS on them anyway.
