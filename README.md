# TutorPro

Website and booking system for a private math and physics tutoring practice (university, IB, AP, SAT, A-Level). The public site markets the practice (editable tutor profile, courses, free sample resources, reviews); students request sessions, take a placement assessment, book through Calendly and get study material in their dashboard; the tutor runs requests, bookings, student courses, the resource library and site content from an admin dashboard.

## Stack

| Piece | Service | Code |
|---|---|---|
| Frontend (React 18 + Vite SPA) | Vercel | `frontend/` |
| API (Express 5 + TypeScript) | Railway | `backend/` |
| Database (Postgres) | Supabase | `supabase/` |
| Auth | Clerk | `frontend/src/auth/`, `backend/src/middleware/auth.ts` |
| Booking | Calendly | `frontend/src/pages/Book*`, `backend/src/routes/webhooks.ts` |
| Email | Resend | `backend/src/lib/mail.ts` |
| Resource files | Supabase Storage (private bucket `resources`) | `backend/src/routes/resources.ts` |

The browser only talks to the API; only the API talks to Supabase. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the HTTP contract and env vars, and [`docs/DEPLOY.md`](docs/DEPLOY.md) for setting up the accounts.

Taking over the project? Start with [`docs/HANDOFF.pdf`](docs/HANDOFF.pdf): accounts to hand over, how everything fits together, production config, testing, deployment, troubleshooting and open items (as of 2026-10-31). Remaining owner to-dos: [`docs/TODO.md`](docs/TODO.md).

## Roles

| Role | Can |
|---|---|
| Visitor | Browse, open public resources, send a contact/session request, take the assessment (unsaved). |
| Student | Everything above, plus: students-only and privately shared resources, saved assessments, own requests and bookings (reschedule/cancel links), register/drop courses, leave reviews. |
| Admin | Accept/decline requests, see all bookings, a full record per student (requests, sessions, courses, assessments, shared material), upload/share resources, assign courses and set progress, approve reviews, edit the tutor profile and photo, assessment questions, courses, exam tracks, FAQ, policies and dropdown options. |

Admin = Clerk user with public metadata `{ "role": "admin" }`.

## Local development

Node 22+, Docker (for local Supabase).

```bash
npm install
supabase start                                  # local Postgres + API, applies migrations + seed
cp backend/.env.example backend/.env            # fill Clerk keys; Supabase URL/key from supabase/README.md
cp frontend/.env.example frontend/.env.local    # VITE_CLERK_PUBLISHABLE_KEY, VITE_API_URL=http://localhost:4000
npm run dev:backend                             # http://localhost:4000
npm run dev:frontend                            # http://localhost:5173
```

Resend and Calendly are optional locally; the API logs and skips them when unset.

### Local dev without Clerk

Run the backend with `DEV_AUTH=1` (and no Clerk keys) against local Supabase, and the frontend with
`VITE_DEV_AUTH=1` (and no `VITE_CLERK_PUBLISHABLE_KEY`). `/sign-in` then offers "Tutor (admin)" and
"Student" buttons for the seeded users. The backend refuses this mode unless Clerk is unconfigured,
`NODE_ENV` isn't `production` and `SUPABASE_URL` is localhost, and production builds of the frontend
never include it.

### End-to-end tests

```bash
supabase start      # once
npm run e2e         # resets the local DB, starts API (:4100) + app (:5180) in DEV_AUTH mode, runs Playwright in your Chrome
```

`e2e/tutor-app.spec.ts` walks the whole app: request -> accept -> Calendly booking/cancel (signed
webhooks), resource upload/share/download, tutor profile + photo, editable assessment, student
records, review moderation, course and policy editing, and access control.

```bash
npm run typecheck   # frontend + backend
npm test            # backend (vitest)
npm run build       # frontend/dist + backend/dist
```
