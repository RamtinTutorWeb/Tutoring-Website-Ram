# TutorPro: owner to-dos

The app is built, tested and live. These steps need access to the service accounts, so the project owner has to do them.
For details on each one, see [`HANDOFF.pdf`](HANDOFF.pdf).

## 1. Fix email (most important: almost no emails are delivered today)

- [ ] Resend → Domains: add your domain, add its DNS records, and wait for "Verified".
- [ ] Railway → tutorpro-backend → Variables: set `MAIL_FROM` to an address on that domain, e.g. `TutorPro <hello@yourdomain.com>`.
  Right now it is `onboarding@resend.dev`, which only delivers to the Resend account owner.
- [ ] Railway → tutorpro-backend → Variables: set `ADMIN_EMAIL` to the tutor's inbox.
  Without it, the tutor gets no email when a new request comes in.

## 2. Rotate the backend keys (Railway security incident on 2026-10-21)

Create a new value for each of these in its own dashboard, then paste it into Railway → tutorpro-backend → Variables:

- [ ] `CLERK_SECRET_KEY` (Clerk → API keys)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API). This one matters most: it gives full database access.
- [ ] `RESEND_API_KEY` (Resend → API keys)
- [ ] `CALENDLY_WEBHOOK_SIGNING_KEY` (generate one with `openssl rand -hex 32`), then re-register the Calendly webhook (step 4).
- [ ] `ADMIN_API_TOKEN` (generate one with `openssl rand -hex 32`)

## 3. Set up the tutor and the content

- [ ] The tutor signs up on the site.
- [ ] Clerk → Users → the tutor → Public metadata: `{ "role": "admin" }`. Then sign out and back in, and the Admin link appears.
- [ ] Admin → Courses: add the courses. The list is empty today.
- [ ] Admin → About me: add the photo, intro and sections.
- [ ] Admin → Assessment and Admin → Policy: replace the default text.
- [ ] Admin → Contact & booking: paste the Calendly event link.

## 4. Check that bookings reach the site

- [ ] Make one test booking through the site. If it appears in the student dashboard and in Admin → Booked sessions, the Calendly webhook is working.
- [ ] If it doesn't appear: create a Calendly personal access token (needs a paid Calendly plan), set `CALENDLY_PERSONAL_ACCESS_TOKEN` on Railway, then run:
  ```bash
  curl -X POST https://tutorpro-backend-production.up.railway.app/admin/calendly/register-webhook \
    -H "x-admin-token: $ADMIN_API_TOKEN"
  ```
  A 409 response means it is already registered.

## 5. Full test run (after steps 1–4)

- [ ] As a student (use another email or a private window): sign up, take the assessment, and send a request from /contact.
- [ ] The tutor gets the new-request email, then accepts the request in Admin → Overview.
- [ ] The student gets the "accepted" email, books through Calendly, then cancels from the dashboard. Check that the request can be booked again.
- [ ] The tutor shares a private resource with the student. The student gets an email and can open the resource.

## Later (nice to have)

- [ ] Custom domain: move Clerk to a production instance (`pk_live_` keys), then update the URLs. See the Deployment section of the handoff document.
- [ ] Vercel: set `VITE_SITE_URL` to the live site address, for link previews and the sitemap.
- [ ] Run `railway config migrate` before 2026-12-01, when Railway stops supporting `railway.json`.
- [ ] Check that Railway auto-deploys from GitHub `main` again. It didn't for the last merge.
- [ ] Add a GitHub Actions workflow that runs typecheck, tests and build on every PR.
- [ ] Remove the duplicate `/resources` route in `frontend/src/router`.
- [ ] Decide on payments, e.g. Stripe or Calendly's built-in payments.
