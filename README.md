# TutorPro

Website and booking system for a private math and physics tutoring practice (university, IB, AP, SAT, A-Level). Public pages market the practice; students request sessions, take a placement assessment and book through Calendly; the tutor runs requests, bookings, student courses and site content from an admin dashboard.

## Stack

| Piece | Service | Code |
|---|---|---|
| Frontend (React 18 + Vite SPA) | Vercel | `frontend/` |
| API (Express 5 + TypeScript) | Railway | `backend/` |
| Database (Postgres) | Supabase | `supabase/` |
| Auth | Clerk | `frontend/src/auth/`, `backend/src/middleware/auth.ts` |
| Booking | Calendly | `frontend/src/pages/Book*`, `backend/src/routes/webhooks.ts` |
| Email | Resend | `backend/src/lib/mail.ts` |

The browser only talks to the API; only the API talks to Supabase. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the HTTP contract and env vars, and [`docs/DEPLOY.md`](docs/DEPLOY.md) for setting up the accounts.

## Roles

| Role | Can |
|---|---|
| Visitor | Browse, send a contact/session request, take the assessment (unsaved). |
| Student | Everything above, plus: saved assessments, own requests and bookings, register/drop courses, leave reviews. |
| Admin | Accept/decline requests, see all bookings and users, assign courses and set progress, approve reviews, edit courses, exam tracks, FAQ and dropdown options. |

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

```bash
npm run typecheck   # frontend + backend
npm test            # backend (vitest)
npm run build       # frontend/dist + backend/dist
```
