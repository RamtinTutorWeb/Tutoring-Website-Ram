# TutorPro backend

Express 5 + TypeScript API. The only client of Supabase (service-role key); auth
is Clerk; email is Resend; bookings arrive from Calendly webhooks. The HTTP
contract is `docs/ARCHITECTURE.md`.

```bash
cp backend/.env.example backend/.env    # fill in; see comments
npm run dev -w backend                  # tsx watch on :4000
npm test -w backend                     # vitest + supertest (no network)
npm run build -w backend && npm start -w backend
```

Local database: `supabase start` from the repo root applies
`supabase/migrations/*` and `supabase/seed.sql`. Use `SUPABASE_URL=http://127.0.0.1:54321`
and the local service-role key.

## Layout

```
src/
  server.ts            listen + graceful shutdown
  app.ts               createApp(): middleware order, CORS allowlist, routers
  env.ts               typed env, configured() for /health
  errors.ts            HttpError helpers + JSON error handler
  db.ts                every Supabase query; snake_case rows -> camelCase API types
  types.ts             API shapes (mirror of the contract)
  middleware/auth.ts   requireAuth / requireAdmin / ensureProfile / x-admin-token
  lib/clerk.ts         clerkMiddleware wrapper, session user id, cached Clerk user
  lib/mail.ts          Resend + the two email templates
  lib/calendly.ts      webhook HMAC verify, subscription registration
  lib/content.ts       selectable option defaults + normalization
  routes/*.ts          one router per resource; webhooks.ts takes raw bodies
                       (reviews.ts + DELETE/assign on learner-courses extend the contract for the frontend)
test/                  vitest; db.ts and lib/clerk.ts are replaced by in-memory fakes
```

## Auth and roles

- `clerkMiddleware()` verifies the `Authorization: Bearer <Clerk session token>`
  header. In production it also checks the token's `azp` against `FRONTEND_URL`.
- The role is read from the Clerk user's `publicMetadata.role` (`admin`, anything
  else is `student`) via the Clerk Backend API, cached in memory for 60s per user.
  To make someone admin, set `{"role":"admin"}` in their public metadata in the
  Clerk dashboard; it takes effect within a minute.
- `profiles.role` is a mirror (Clerk webhook + `GET /me`), used for listing, never
  for authorization.

## Webhooks

- `POST /webhooks/clerk`: Svix-signed. Upserts/deletes `profiles`.
- `POST /webhooks/calendly`: `Calendly-Webhook-Signature` HMAC, 3 minute tolerance.
  Upserts `bookings` by invitee URI; `utm_content=<request id>` links the booking to
  a request and marks it `scheduled` (a cancel puts it back to `accepted`).
- Both are idempotent via `webhook_events`; a failed event is un-recorded so the
  provider's retry is processed.
- Register Calendly once: `curl -X POST $PUBLIC_API_URL/admin/calendly/register-webhook -H "x-admin-token: $ADMIN_API_TOKEN"`.
