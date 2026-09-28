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

- `POST /webhooks/clerk`: Svix-signed. Inserts/deletes `profiles`; on an existing row only
  email and role are mirrored, so a name/phone edited via `PATCH /me` is kept.
- `POST /webhooks/calendly`: `Calendly-Webhook-Signature` HMAC, 3 minute tolerance.
  Upserts `bookings` by invitee URI (group events: many invitees per event URI).
  `utm_content=<request id>` links the booking to a request and marks it `scheduled`;
  without it the link comes from this invitee's existing row or its `old_invitee`
  (reschedules). The student is the request's student; invitee-email matching is only
  used when there is no request. A cancel reopens the request (`accepted`) only when it
  isn't half of a reschedule and no other booking for the request is still scheduled.
- Both are idempotent via `webhook_events`; a failed event is un-recorded so the
  provider's retry is processed.
- Register Calendly once: `curl -X POST $PUBLIC_API_URL/admin/calendly/register-webhook -H "x-admin-token: $ADMIN_API_TOKEN"`.
