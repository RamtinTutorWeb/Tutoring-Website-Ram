# Deploying TutorPro

Order matters: Supabase → Clerk → Railway (API) → Vercel (frontend) → webhooks → Resend → Calendly → custom domain.
Env var reference: [`ARCHITECTURE.md`](ARCHITECTURE.md#env-contract). Never put a secret in a `VITE_*` var.

## 1. Supabase (database)

```bash
supabase login
supabase projects create tutorpro --org-id <org> --region us-east-1 --db-password '<save this>'
supabase link --project-ref <ref>
supabase db push                       # applies supabase/migrations/* (do NOT run seed.sql in prod)
supabase projects api-keys --project-ref <ref>
```

- `SUPABASE_URL` = `https://<ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = the `service_role` key (Railway only)

Free-tier projects pause after 7 days without DB activity (API then returns 500 on every DB route). `.github/workflows/keepalive.yml` pings `GET /content` daily to prevent that.

No anon key, no Supabase Auth, no third-party auth setup: the browser never reaches Supabase.

## 2. Clerk (auth)

Dashboard → Create application `TutorPro`, enable Email + Google.
- `CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` = `pk_…`
- `CLERK_SECRET_KEY` = `sk_…`

Make the tutor admin: Users → user → Public metadata `{ "role": "admin" }`.

## 3. Railway (API)

Project from the GitHub repo (`RamtinTutorWeb/Tutoring-Website-Ram`; grant the Railway GitHub app access to the org), **root directory = repo root**. Build/start/healthcheck come from `railway.json`.

Variables: every backend var in `backend/.env.example`. Generate `CALENDLY_WEBHOOK_SIGNING_KEY` and `ADMIN_API_TOKEN` with `openssl rand -hex 32`. Leave `PORT` unset (Railway injects it).
Settings → Networking → Generate domain → that origin is `PUBLIC_API_URL`.
Check: `curl https://<api>/health` → `configured` flags all `true` once every var is set.

## 4. Vercel (frontend)

Import the repo, **root directory = repo root** (`vercel.json` builds only the frontend workspace).
Env (Production + Preview): `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL` (= Railway origin), `VITE_CALENDLY_URL`.
Then set Railway `FRONTEND_URL` to the Vercel origin(s), comma-separated, and redeploy the API (CORS + Clerk authorized parties).
Preview deployments get random `*.vercel.app` origins that are not in `FRONTEND_URL`, so their API calls are blocked by CORS. Test on production (or add a fixed preview alias to `FRONTEND_URL`).

## 5. Clerk webhook

Clerk → Webhooks → Add endpoint `https://<api>/webhooks/clerk`, events `user.created`, `user.updated`, `user.deleted`. Signing secret → Railway `CLERK_WEBHOOK_SIGNING_SECRET`.

## 6. Resend (email)

Resend → Domains → add the sending domain, add its DNS records, wait for Verified. API key (sending access) → `RESEND_API_KEY`. `MAIL_FROM` = `TutorPro <hello@<domain>>`, `ADMIN_EMAIL` = tutor inbox.
Without a verified domain Resend only delivers to the account owner's address.

## 7. Calendly (booking)

- Event type → Copy link → paste it in the site's **Admin → Contact & booking** (no redeploy). `VITE_CALENDLY_URL` is only a fallback.
- Integrations → API & webhooks → Personal access token → Railway `CALENDLY_PERSONAL_ACCESS_TOKEN`. Webhooks need a paid (Standard+) plan.
- Register the webhook (idempotent, 409 = already exists):
  ```bash
  curl -X POST https://<api>/admin/calendly/register-webhook -H "x-admin-token: $ADMIN_API_TOKEN"
  ```

## 8. Custom domain

- Vercel: add `<domain>` (and `www`). Railway: add `api.<domain>` as a custom domain.
- Update `VITE_API_URL` (Vercel), `FRONTEND_URL` + `PUBLIC_API_URL` (Railway), redeploy both.
- Clerk: create the **production instance**, add its DNS records, swap to `pk_live_`/`sk_live_` keys, re-add the webhook and Google OAuth credentials there.
- Re-point the Calendly webhook: delete the old subscription, run step 7's curl again.

## Smoke test

1. `GET /health` all true. 2. Home shows courses/reviews. 3. Contact form → tutor gets an email. 4. Sign up → `profiles` row exists. 5. Admin accepts the request → student gets the `/book?request=…` email. 6. Book on Calendly → dashboard shows the booking; cancel → it flips to canceled.
