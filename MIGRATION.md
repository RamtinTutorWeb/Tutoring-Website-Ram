# TutorPro platform migration runbook

Target stack: **Supabase Postgres** (data) + **Clerk** (auth) + **Calendly** (booking) + **Vercel** (hosting: Vite SPA + `api/` serverless functions).

Follow the steps in order. Each step names the env var it produces. Keep a scratch file with the values; you will paste them into Vercel in step 4.

Env var summary (server vars go in Vercel Project settings and `.env.local`; `VITE_*` vars are public and go in `frontend/.env` locally and in Vercel too, because the build runs there):

| Var | Produced in | Scope | Secret |
|---|---|---|---|
| `VITE_SUPABASE_URL` | 1 | frontend | no |
| `VITE_SUPABASE_ANON_KEY` | 1 | frontend | no |
| `SUPABASE_URL` | 1 | server | no |
| `SUPABASE_SERVICE_ROLE_KEY` | 1 | server | **yes** |
| `VITE_CLERK_PUBLISHABLE_KEY` | 2 | frontend | no |
| `CLERK_SECRET_KEY` | 2 | server | **yes** |
| `CLERK_WEBHOOK_SIGNING_SECRET` | 2 | server | **yes** |
| `VITE_CALENDLY_URL` | 3 | frontend | no |
| `CALENDLY_PERSONAL_ACCESS_TOKEN` | 3 | server (optional) | **yes** |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | 3 | server | **yes** |
| `PUBLIC_BASE_URL` | 4 | server | no |
| `ADMIN_API_TOKEN` | 4 | server | **yes** |
| `VITE_BACKEND_URL` | legacy | frontend | no |

---

## 1. Supabase

1. https://supabase.com/dashboard → **New project**. Name `tutorpro`, pick the region closest to students, set and save the database password (only needed for CLI/psql).
2. **Project Settings → API** (called *Data API* / *API Keys* in newer dashboards):
   - Project URL → `SUPABASE_URL` **and** `VITE_SUPABASE_URL`
   - `anon` / *publishable* key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` / *secret* key → `SUPABASE_SERVICE_ROLE_KEY` (server only, never in `VITE_*`)
3. Apply the schema, either way:
   - **SQL editor**: dashboard → SQL Editor → New query → paste `supabase/migrations/20260903000000_init.sql` → Run. Then paste `supabase/seed.sql` → Run (if you want seed content).
   - **CLI**:
     ```bash
     npm i -g supabase
     supabase login
     supabase link --project-ref <ref>      # ref = the subdomain of the Project URL
     supabase db push                       # applies supabase/migrations/*
     ```
4. Enable Clerk as third-party auth (needed so RLS can read `auth.jwt()->>'sub'`):
   **Authentication → Sign In / Providers → Third-party auth → Add provider → Clerk** → paste the Clerk domain from step 2.4 (you will come back here after creating the Clerk app). Save.
5. Sanity check: **Table Editor** should list `profiles`, `session_requests`, `bookings`, `webhook_events`, `site_settings`, `assessments`, `learner_courses`.

## 2. Clerk

1. https://dashboard.clerk.com → **Create application**. Name `TutorPro`. Under sign-in options enable **Email** and **Google**. Create.
2. **Configure → API keys** (choose the *React* / *Vite* snippet):
   - Publishable key `pk_test_…` → `VITE_CLERK_PUBLISHABLE_KEY`
   - Secret key `sk_test_…` → `CLERK_SECRET_KEY`
3. **Configure → Email, phone, username**: require email address; leave phone optional. **Configure → SSO connections → Google**: enabled for dev with Clerk's shared credentials; for production add your own Google OAuth client (Google Cloud Console → Credentials → OAuth client → paste Clerk's redirect URI).
4. **Configure → Integrations → Supabase** → **Activate**. Copy the **Clerk domain** shown (e.g. `xxxx.clerk.accounts.dev`) → paste it into Supabase step 1.4. This makes Clerk session tokens carry `role: authenticated` so Supabase accepts them.
5. Make yourself admin: **Users → your user → Metadata → Public metadata** → set
   ```json
   { "role": "admin" }
   ```
   Save. The Clerk webhook (next step) copies this into `profiles.role`. (Sign up first if the user does not exist yet; the value can be set before or after the webhook exists, `user.updated` re-syncs it.)
6. Webhook (do this after step 4 gives you a domain, or use the Vercel-generated `*.vercel.app` URL now and edit later):
   **Configure → Webhooks → Add endpoint**
   - Endpoint URL: `https://<domain>/api/clerk/webhook`
   - Subscribe to events: `user.created`, `user.updated`, `user.deleted`
   - Create → copy **Signing secret** `whsec_…` → `CLERK_WEBHOOK_SIGNING_SECRET`
7. After the Vercel domain exists (step 4): **Configure → Domains** (production instance) or **Configure → Paths / Allowed origins** (dev instance) → add `https://<domain>`. Dev instances accept `localhost` automatically.

Local testing of the Clerk webhook: **Webhooks → endpoint → Testing → Send example** (needs a public URL; `vercel dev` behind `ngrok http 3000` works, or use the Clerk CLI's local webhook forwarding).

## 3. Calendly

1. https://calendly.com → **Event types → Create → One-on-one**. Name it e.g. `Tutoring session (60 min)`, set duration, availability, buffer, and cancellation policy. Repeat per duration if needed. Add **Invitee questions** you want (phone is useful; subject/topic is optional since requests already carry it).
2. Copy the scheduling link of the main event type (Event type → *Copy link*, e.g. `https://calendly.com/<handle>/tutoring-session`) → `VITE_CALENDLY_URL`. The `/book` page embeds it and appends `utm_content=<request uuid>` so the webhook can link the booking to the `session_requests` row.
3. Personal access token: **Integrations & apps → API & webhooks → Personal access tokens → Generate new token** → `CALENDLY_PERSONAL_ACCESS_TOKEN`. (Webhooks require a Calendly Standard plan or higher.)
4. Choose a webhook signing key yourself: `openssl rand -hex 32` → `CALENDLY_WEBHOOK_SIGNING_KEY`. Calendly signs with whatever `signing_key` you pass when creating the subscription.
5. Create the webhook subscription **after** the Vercel deploy exists (step 4), because Calendly must be able to reach the URL. Two options:
   - **Endpoint (no curl to Calendly needed)** — with `PUBLIC_BASE_URL`, `ADMIN_API_TOKEN`, `CALENDLY_PERSONAL_ACCESS_TOKEN`, `CALENDLY_WEBHOOK_SIGNING_KEY` set in Vercel:
     ```bash
     curl -X POST https://<domain>/api/calendly/register-webhook \
          -H "x-admin-token: $ADMIN_API_TOKEN"
     ```
     It fetches `/users/me`, then creates an organization-scoped subscription for `invitee.created` + `invitee.canceled` at `https://<domain>/api/calendly/webhook` and returns Calendly's JSON. 409 means it already exists.
   - **Direct API call** (equivalent):
     ```bash
     ME=$(curl -s https://api.calendly.com/users/me -H "Authorization: Bearer $CALENDLY_PERSONAL_ACCESS_TOKEN")
     ORG=$(echo "$ME" | jq -r .resource.current_organization)
     USER_URI=$(echo "$ME" | jq -r .resource.uri)
     curl -X POST https://api.calendly.com/webhook_subscriptions \
       -H "Authorization: Bearer $CALENDLY_PERSONAL_ACCESS_TOKEN" -H "Content-Type: application/json" \
       -d "{\"url\":\"https://<domain>/api/calendly/webhook\",\"events\":[\"invitee.created\",\"invitee.canceled\"],\"organization\":\"$ORG\",\"user\":\"$USER_URI\",\"scope\":\"organization\",\"signing_key\":\"$CALENDLY_WEBHOOK_SIGNING_KEY\"}"
     ```
   List / delete subscriptions: `GET https://api.calendly.com/webhook_subscriptions?organization=$ORG&scope=organization`, `DELETE https://api.calendly.com/webhook_subscriptions/<uuid>`.
6. Verify: book a test slot through `/book`; `bookings` gets a row with `status='scheduled'`; cancel it from the Calendly email; the row flips to `canceled`. `webhook_events` shows one row per delivery.

## 4. Vercel

1. https://vercel.com/new → **Import** the GitHub repo. **Root Directory: leave as repo root** (do not pick `frontend/`). Framework preset is read from `vercel.json` (`framework: null`, `npm ci`, `npm run build`, output `frontend/dist`). `npm ci` installs all workspaces including `backend/`; harmless, just slower.
2. **Environment Variables** (before the first deploy, apply to Production and Preview). Server vars from `.env.example`, frontend vars from `frontend/.env.example`:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | step 1 (mark *Sensitive*) |
   | `CLERK_SECRET_KEY` | step 2 (Sensitive) |
   | `CLERK_WEBHOOK_SIGNING_SECRET` | step 2 (Sensitive) |
   | `CALENDLY_WEBHOOK_SIGNING_KEY` | step 3 (Sensitive) |
   | `CALENDLY_PERSONAL_ACCESS_TOKEN` | step 3 (Sensitive, optional) |
   | `ADMIN_API_TOKEN` | `openssl rand -hex 32` (Sensitive) |
   | `PUBLIC_BASE_URL` | `https://<domain>` — set to the `*.vercel.app` URL first, change after step 5 |
   | `VITE_CLERK_PUBLISHABLE_KEY` | step 2 |
   | `VITE_SUPABASE_URL` | step 1 |
   | `VITE_SUPABASE_ANON_KEY` | step 1 |
   | `VITE_CALENDLY_URL` | step 3 |
   | `VITE_BACKEND_URL` | current Express backend URL, until the cutover checklist is done |

3. **Deploy**. Then check `https://<app>.vercel.app/api/health` → `{"ok":true,"configured":{"clerk":true,"supabase":true,"calendly":true}}`. Any `false` means a var is missing or blank.
4. Node version: Project → Settings → General → Node.js version **22.x** (default). `api/` is compiled as CommonJS and `svix` is ESM-only, which Node 22 loads via `require(esm)`. Do not select Node 18/20.
5. **Domain**: Settings → Domains → add `tutorpro.<yourdomain>`, follow the DNS instructions. Then:
   - update `PUBLIC_BASE_URL` to `https://tutorpro.<yourdomain>` and redeploy,
   - add the domain to Clerk (step 2.7) and, for a Clerk production instance, finish Clerk's DNS records,
   - point the Clerk webhook endpoint (2.6) and the Calendly subscription (3.5) at the final domain if you created them with the `*.vercel.app` URL.
6. Security headers are set in `vercel.json` (`nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`). **No Content-Security-Policy is set on purpose**: Clerk (`*.clerk.accounts.dev`, `clerk.<domain>`, `challenges.cloudflare.com` for bot protection) and Calendly (`calendly.com`, `assets.calendly.com`) need `script-src`, `frame-src`/`child-src`, `connect-src` allowances that change as those vendors update. Add a CSP later only after collecting report-only violations.

## 5. Local development

Option A — full stack through Vercel (functions + SPA on one port):

```bash
npm i -g vercel          # once; `vercel dev` is not a project dependency
vercel link              # once, picks the Vercel project
cp .env.example .env.local && $EDITOR .env.local          # server vars (git-ignored)
cp frontend/.env.example frontend/.env && $EDITOR frontend/.env
npm run dev:vercel       # http://localhost:3000, /api/* served from api/
```

Option B — frontend only:

```bash
cp frontend/.env.example frontend/.env
npm run dev              # http://localhost:5173
```

With `VITE_CLERK_PUBLISHABLE_KEY` empty the app runs in **legacy mode** (JWT + Express, needs `npm run dev:backend`); the platform auth layer also ships a mock auth provider for UI work without Clerk (see `frontend/src/platform/auth/`). With the key set it uses Clerk; Clerk dev instances accept `localhost` origins without extra setup.

Typecheck the functions: `npm run typecheck:api`.

## 6. Cutover checklist

The Express backend (`backend/`, MongoDB) **keeps running and stays wired via `VITE_BACKEND_URL` until every row below is done**. Retire it last.

| Legacy piece | Replaced by | Status |
|---|---|---|
| `backend/routes/userRouter.js` register / login / OAuth / password reset; `/login`, `/forgot-password`, `/reset-password` pages | Clerk hosted flows: `/sign-in`, `/sign-up` (`frontend/src/platform/auth/`), Clerk account portal for password reset; `api/clerk/webhook.ts` → `profiles` | pending |
| `peertrack_token` in `localStorage`, Bearer header in `frontend/src/clients/apiClient.ts` | Clerk session token passed to supabase-js (`frontend/src/platform/db/client.ts`); no custom token storage | pending |
| `AppContext` in-browser data copy synced to `localStorage` | Supabase queries per feature (`frontend/src/platform/db/queries.ts`) under RLS; `AppContext` shrinks to UI state | pending |
| `backend/routes/requestRouter.js` + `session_requests` in the Mongo settings blob | `session_requests` table, written by the browser under RLS; admin accept/decline via Supabase | pending |
| `backend/routes/availabilityRouter.js`, session slots, booking calendar in dashboard | Calendly event types + `/book` page; `bookings` table filled by `api/calendly/webhook.ts`; dashboard reads `bookings` | pending |
| `backend/routes/settingsRouter.js` site content blob (courses, reviews, FAQ, dropdown options) | `site_settings` table (`key` → `content` jsonb), admin-only write policy | pending |
| `backend/routes/learnerRouter.js` course assignments / progress | `learner_courses` table | pending |
| `backend/routes/alumniRouter.js`, `parent`/`tutor` roles | dropped (no replacement) | pending |
| Assessment answers stored in `AppContext` | `assessments` table | pending / see open decisions |
| Mail via Mailtrap/SMTP/Resend (password reset, request notifications) | Clerk sends auth emails; request/booking notifications: Calendly emails for bookings, TBD for new requests (Resend from an `api/` function, or Supabase database webhook) | pending |
| `netlify.toml`, Netlify site | `vercel.json`, Vercel project; delete the Netlify site after DNS moves | pending |
| `ADMIN_SIGNUP_CODE` admin signup | `publicMetadata.role = 'admin'` set in the Clerk dashboard (no self-serve admin signup) | pending |
| `backend/` workspace, `mongodb` root dependency, `VITE_BACKEND_URL` | remove once all rows above are done; export Mongo data first (`mongoexport`) and import what is still needed into Postgres | last |

## 7. Decisions still open

- **Assessment feature**: keep the placement assessment (needs a UI rewrite against `assessments`) or drop it and rely on the request form's "hard topics" field. Table exists either way.
- **In-app content editor vs. hardcode**: keep the admin settings editor backed by `site_settings`, or hardcode courses / exam tracks / reviews / FAQ in `frontend/src/data` and delete the editor. Hardcoding removes a whole admin surface and RLS write path.
- **Session request form alongside Calendly**: keep "request → admin accepts → student books on Calendly with `?request=<id>`" (current design, gives the tutor a triage step), or let students book directly and drop `session_requests`. The Calendly webhook already handles both (a booking without `utm_content` simply has no `request_id`).
- **On cancellation**: should `session_requests.status` revert from `scheduled` to `accepted` when the Calendly booking is canceled? The webhook currently leaves the request as-is.
- **Notifications for new session requests**: email to the tutor via Resend from an `api/` function, or a Supabase database webhook. Not implemented.
