# TutorPro architecture

```
 Browser ──> Vercel (frontend/, static Vite SPA)
    │            Clerk <SignIn/SignUp> + Calendly embed
    │  fetch(VITE_API_URL, Authorization: Bearer <Clerk session token>)
    v
 Railway (backend/, Express + TypeScript)
    ├── Clerk      verify session tokens, read publicMetadata.role
    ├── Supabase   Postgres via service-role key (the ONLY DB client)
    ├── Resend     transactional email (new request -> tutor, status change -> student)
    └── Webhooks   POST /webhooks/clerk (svix), POST /webhooks/calendly (HMAC)
 Supabase: Postgres only. No browser access: RLS on, no anon/authenticated policies.
 Calendly: event types + booking UI; invitee.created/canceled -> /webhooks/calendly
```

Rules
- The browser never talks to Supabase. `@supabase/supabase-js` lives only in `backend/`.
- Auth = Clerk. Role source of truth = Clerk `publicMetadata.role` (`admin` | default `student`),
  mirrored to `profiles.role` by the Clerk webhook and by `GET /me` (upsert on first call).
- Admin UI lives at `/admin/:tab` (RequireAdmin). Public pages are read-only; admins get an "Edit this page" link.
- Custom slot calendar is gone. Booking = Calendly. Flow: visitor/student submits a request on
  /contact -> tutor emailed -> admin accepts -> student books on /book?request=<id> (utm_content).
- No MongoDB, no passport, no JWT of our own, no localStorage DB.

## Env contract

Frontend (Vercel, public, baked at build):
| Var | Example |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_...` |
| `VITE_API_URL` | `https://api.<domain>` (Railway), `http://localhost:4000` locally |
| `VITE_CALENDLY_URL` | `https://calendly.com/<handle>/tutoring-session` |

Backend (Railway, secret):
| Var | Notes |
|---|---|
| `PORT` | Railway injects it; default 4000 |
| `FRONTEND_URL` | comma-separated allowed CORS origins |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | used by `@clerk/express` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `whsec_...` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | service role, server only |
| `RESEND_API_KEY`, `MAIL_FROM` | e.g. `TutorPro <hello@<domain>>` |
| `ADMIN_EMAIL` | tutor inbox for new-request notifications |
| `CALENDLY_PERSONAL_ACCESS_TOKEN` | only for webhook registration |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | `openssl rand -hex 32` |
| `PUBLIC_API_URL` | public origin of the backend, for Calendly callback URL |
| `ADMIN_API_TOKEN` | `x-admin-token` for `/admin/*` maintenance routes |

Missing optional integrations (Resend, Calendly) must degrade gracefully: log + skip, never crash.
`GET /health` reports `{ ok, configured: { clerk, supabase, resend, calendly } }`.

## HTTP API (backend)

`PUT /content` replaces each provided key wholesale and preserves client-generated ids.
`pages` is per page: each page present in `pages` replaces that page, others are kept. Missing stored fields fall back to
`DEFAULT_PAGES` (`backend/src/lib/content.ts`). URLs must be `https://` (`booking.calendlyUrl` on calendly.com).
`POST` creates return 201 with the JSON body; `DELETE` returns 204. CORS allows `Authorization`, `Content-Type`.
Request ids in `/book?request=` are opaque strings.

Behavior details:
- Role = Clerk `publicMetadata.role`, read via the Clerk API and cached 60 s per user. `profiles.role` is a mirror only, never used for authorization.
- `GET /content` hides pending reviews unless the caller is admin (auth optional on that route).
- `POST /learner-courses` returns 400 for a `courseId` not in the content catalog.
- A Calendly cancel moves the request `scheduled` -> `accepted` so the student can rebook.
- `POST /requests` is rate-limited (10 / 15 min / IP, 429). Malformed `:id` -> 404.
- `/webhooks/calendly` returns 503 when `CALENDLY_WEBHOOK_SIGNING_KEY` is unset.

JSON everywhere, camelCase in/out (backend maps to snake_case columns). Errors: `{ error: string }`
with 400/401/403/404/409/500. `auth` = valid Clerk session required; `admin` = role admin.

| Method | Path | Access | Body / Result |
|---|---|---|---|
| GET | `/health` | public | see above |
| GET | `/content` | public | `SiteContent` |
| PUT | `/content` | admin | `Partial<SiteContent>` -> `SiteContent` |
| GET | `/me` | auth | `Profile` (upserts profile from Clerk on first call) |
| PATCH | `/me` | auth | `{ fullName?, phone? }` -> `Profile` |
| POST | `/requests` | public (auth optional; attaches studentId if signed in) | `NewRequest` -> `SessionRequest`; emails `ADMIN_EMAIL` |
| GET | `/requests` | auth | student: own; admin: all. `SessionRequest[]` newest first |
| PATCH | `/requests/:id` | admin | `{ status }` -> `SessionRequest`; on `accepted` email requester the `/book?request=<id>` link |
| GET | `/bookings` | auth | student: own; admin: all. `Booking[]` by startAt |
| GET | `/learner-courses` | auth | student: own; admin: all. `LearnerCourse[]` |
| POST | `/learner-courses` | auth | `{ courseId, studentId? }` -> `LearnerCourse` (status registered; 409 if exists). `studentId` only honored for admin (assign); students always self |
| PATCH | `/learner-courses/:id` | admin | `{ status }` -> `LearnerCourse` |
| DELETE | `/learner-courses/:id` | auth | admin: any; student: own. 204 |
| POST | `/reviews` | auth | `{ rating: 1-5, text, name? }` -> 201 `Review`; student -> `pending`, admin -> `approved`; name defaults to profile fullName. Rate-limited per user; 429 when too many pending |
| PATCH | `/reviews/:id` | admin | `{ status?, name?, rating?, text? }` -> `Review` |
| DELETE | `/reviews/:id` | admin | 204 |

Reviews live in their own `reviews` table. `GET /content` returns `reviews` (approved only; admin gets all);
`PUT /content` does NOT accept `reviews` (400 if present) — use the `/reviews` routes.
| POST | `/assessments` | auth | `{ subject, answers, score, total, recommendation }` -> `Assessment` |
| GET | `/assessments` | auth | student: own; admin: all |
| GET | `/admin/users` | admin | `Profile[]` |
| POST | `/webhooks/clerk` | svix-signed | upsert/delete `profiles` |
| POST | `/webhooks/calendly` | HMAC-signed | upsert `bookings`, set request `scheduled` |
| POST | `/admin/calendly/register-webhook` | `x-admin-token` | creates Calendly subscription to `${PUBLIC_API_URL}/webhooks/calendly` |

Types (shared shape; frontend keeps its own copy in `frontend/src/api/types.ts`):

```ts
type Role = "student" | "admin";
interface Profile { id: string; email: string; fullName: string | null; phone: string | null; role: Role; createdAt: string }
interface Course { id: string; title: string; category: string; description: string }
interface Review { id: string; name: string; rating: number; text: string; status?: "pending" | "approved" }
interface FaqItem { id: string; question: string; answer: string }
type SelectableOptionKey = "contactMethods" | "serviceTypes" | "urgencyWindows" | "urgencyFlags" | "assessmentSubjects" | "courseCategories";
interface TextSection { id: string; heading: string; body: string }
interface SitePages {
  home: { kicker: string; title: string; subtitle: string; teachingTitle: string; teachingText: string; videoUrl: string };
  about: { title: string; intro: string; photoUrl: string; sections: TextSection[] };
  examPrep: { intro: string; timelinesTitle: string; timelinesText: string };
  policy: { intro: string; sections: TextSection[] };
  contact: { intro: string; email: string; phone: string };
  booking: { calendlyUrl: string; intro: string };   // calendlyUrl overrides VITE_CALENDLY_URL
}
interface SiteContent {
  courses: Course[]; examPrepTracks: Course[]; reviews: Review[]; faq: FaqItem[];
  selectableOptions: Record<SelectableOptionKey, string[]>;
  pages: SitePages;
}
type RequestStatus = "new" | "accepted" | "declined" | "scheduled" | "closed";
interface NewRequest {
  name: string; email: string; phone?: string; contactMethod?: string; serviceType?: string;
  subject?: string; urgencyWindow?: string; isUrgent?: boolean; hardTopics?: string;
  preferredSlot?: string; earliestDate?: string /* YYYY-MM-DD */; message?: string; consultation?: boolean;
}
interface SessionRequest extends Required<Omit<NewRequest, "isUrgent" | "consultation">> {
  id: string; studentId: string | null; isUrgent: boolean; consultation: boolean;
  status: RequestStatus; createdAt: string;
}
interface Booking {
  id: string; studentId: string | null; requestId: string | null; inviteeName: string | null;
  inviteeEmail: string | null; eventTypeName: string | null; startAt: string | null; endAt: string | null;
  status: "scheduled" | "canceled"; cancelReason: string | null;
}
type CourseStatus = "registered" | "in-progress" | "passed";
interface LearnerCourse { id: string; studentId: string; courseId: string; status: CourseStatus; registeredAt: string }
interface Assessment { id: string; studentId: string; subject: string | null; answers: unknown; score: number | null; total: number | null; recommendation: string | null; createdAt: string }
```
