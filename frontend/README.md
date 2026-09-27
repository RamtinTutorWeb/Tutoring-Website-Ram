# TutorPro frontend (React + TypeScript + Vite)

Static SPA deployed to Vercel. It talks only to the backend at `VITE_API_URL`, sending
`Authorization: Bearer <Clerk session token>` when signed in. See `../docs/ARCHITECTURE.md`
for the API contract and env vars.

## Env

Copy `.env.example` to `.env`:

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth. Without it public pages still render and auth routes show a config notice.
- `VITE_API_URL` — backend origin (defaults to `http://localhost:4000` in dev).
- `VITE_CALENDLY_URL` — event link embedded on `/book`.

## Run

```bash
npm install          # from the repo root (workspaces)
npm --workspace frontend run dev
npm --workspace frontend run build
```

## Structure

- `src/api/` — contract types, fetch client, resource hooks, `MeProvider` (`GET /me`, role), `ContentProvider` (`GET/PUT /content`)
- `src/auth/` — Clerk session wrapper, `RequireAuth` / `RequireAdmin`, sign-in/sign-up pages
- `src/pages/` — public pages, `dashboard/` (student + admin), `settings/` (admin content editors)
- `src/components/` — shared UI (Calendly embed, stat cards, load state)
- `src/data/` — default form options and the assessment question bank
