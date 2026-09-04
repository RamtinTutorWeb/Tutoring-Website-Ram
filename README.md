# TutorPro

TutorPro is the website and booking system for a private math and physics tutoring practice. It serves students at the university, IB, AP, SAT, and A-Level levels, and gives the tutor an admin dashboard to run the business from one place.

The site does three jobs:

1. **Markets the practice.** Public pages describe the teaching style, courses, exam prep tracks, reviews, FAQ, and policies.
2. **Onboards students.** A student creates an account, takes a placement assessment, and requests a tutoring session with their subject, urgency, hard topics, and preferred time slot.
3. **Runs the tutor's day.** An admin reviews and accepts or declines requests, manages the session calendar, assigns courses to students, tracks their progress, and edits site content without touching code.

## Who uses it

| Role | What they can do |
|---|---|
| Visitor | Browse the public pages, open the contact form, sign up or log in. |
| Student | Take the assessment, request sessions, see their dashboard (assigned courses, progress, bookings), edit their profile, reset their password. |
| Admin | Everything above plus: accept or decline requests, manage session slots and duration, assign and update student courses, reset student accounts, and edit courses, exam prep tracks, reviews, FAQ, and dropdown options from the settings page. |

Roles named `parent` and `tutor` exist in the code but are hidden in the UI. They are leftovers from an earlier codebase and can be treated as unused.

## Pages

| Route | Purpose |
|---|---|
| `/` | Landing page with hero, teaching style, sample video, and quick links. |
| `/courses` | Course catalog grouped by category. |
| `/exam-prep` | Exam prep tracks (SAT, AP, IB, A-Level). |
| `/assessment` | Placement questionnaire and test. Login required. |
| `/contact` | Contact and consultation request form. |
| `/login` | Sign up and log in. Admin sign up requires an access code. |
| `/forgot-password`, `/reset-password` | Email-based password reset. |
| `/dashboard` | Student view: courses and bookings. Admin view: requests, calendar, students. |
| `/settings` | Admin content and configuration editor. |
| `/profile` | Edit contact details. |
| `/policy` | Cancellation, payment, and conduct policy. |

## How it is built

This is an npm workspace monorepo with two packages.

```
TutorPro/
├── frontend/   React 18 + TypeScript + Vite, React Router
├── backend/    Node + Express 5, Mongoose, JWT auth, Passport OAuth
├── netlify.toml
└── package.json
```

### Frontend

A single-page React app. Application state lives in one React context (`AppContext`) that holds an in-browser copy of the data (users, courses, requests, session slots, and so on) and persists it to `localStorage`. On load it fetches the shared site content from the backend and merges it in. Admin edits are pushed back to the backend so all visitors see the same content.

Auth tokens are stored in `localStorage` and sent as a Bearer header on every API call. The backend URL comes from `VITE_BACKEND_URL`.

### Backend

A REST API backed by MongoDB. Main route groups:

| Prefix | Handles |
|---|---|
| `/users` | Register, login, GitHub and Google OAuth, password reset, profile, admin user management. |
| `/requests` | Create, list, accept, and decline tutoring requests. |
| `/availability` | Session listings and quick stats for the dashboard. |
| `/settings` | Site content blob, selectable dropdown options, and session request email notifications. |

Site content (courses, reviews, FAQ, session slots, learner course records, requests) is stored as a single settings document and updated wholesale by the admin UI.

Email for password resets and request notifications goes through Mailtrap, generic SMTP, or Resend, chosen by `MAIL_PROVIDER`. OAuth and email are optional. The server starts without them and logs which providers are disabled.

## Running locally

Prerequisites: Node 20, a MongoDB instance (local `mongod` or an Atlas URI).

```bash
npm install

# backend
cp backend/.env.example backend/.env   # fill in MONGO_URI, JWT_SECRET, ADMIN_SIGNUP_CODE
npm run dev:backend                    # http://localhost:4000

# frontend
echo "VITE_BACKEND_URL=http://localhost:4000" > frontend/.env.local
npm run dev                            # http://localhost:5173
```

To create the first admin account, sign up on `/login` with the admin access code set in `ADMIN_SIGNUP_CODE`.

### Backend environment variables

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string. |
| `JWT_SECRET` | yes | Signs login tokens. |
| `ADMIN_SIGNUP_CODE` | yes | Code required to register an admin. |
| `PORT` | no | Defaults to 4000. |
| `FRONTEND_URL` | no | Comma-separated allowed origins. Any `localhost` port is always allowed. |
| `GITHUB_*`, `GOOGLE_*` | no | OAuth client ID, secret, and callback URL. Login button is disabled if unset. |
| `MAIL_PROVIDER`, `MAIL_FROM` | no | `mailtrap`, `smtp`, or `resend`, plus the matching credentials. |

## Deployment

The frontend is deployed to Netlify from the `frontend/` folder (see `netlify.toml`). The backend is deployed separately and must be reachable at the URL set in the frontend's `VITE_BACKEND_URL` at build time.

## Status and direction

This is an MVP. The backend was adapted from an earlier peer-tutoring project, which is why some naming (`peertrack_token`, alumni routes, extra roles) does not match the product.

Planned changes:

- Replace custom JWT and Passport auth with **Clerk**.
- Replace the built-in availability and slot system with **Calendly**.
- Move hosting to **Vercel**.
- Move the database from MongoDB to **Supabase Postgres**, since the remaining data (profiles, assessments, requests, bookings, site settings) is relational and small.
