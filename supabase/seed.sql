-- =============================================================================
-- TutorPro dev seed
-- Applied automatically by `supabase start` / `supabase db reset` (local only).
-- Never run against production: profile ids are placeholders, not real Clerk
-- user ids. The backend upserts real Clerk users into profiles on their first
-- GET /me, so sign in locally and promote yourself via Clerk publicMetadata.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
insert into public.profiles (id, email, full_name, phone, role)
values
  ('user_dev_admin',   'admin@local.test',   'Admin User',   null,            'admin'),
  ('user_dev_student', 'student@local.test', 'Student User', '+1 555 0100',   'student')
on conflict (id) do update
  set email     = excluded.email,
      full_name = excluded.full_name,
      phone     = excluded.phone,
      role      = excluded.role;

-- -----------------------------------------------------------------------------
-- Site settings
-- Shapes follow SiteContent in docs/ARCHITECTURE.md: 'content' holds
-- courses/examPrepTracks/reviews/faq, 'selectable_options' the dropdowns.
-- -----------------------------------------------------------------------------
insert into public.site_settings (key, content)
values
  (
    'content',
    $json$
    {
      "courses": [
        {
          "id": "course_calculus_1",
          "title": "Calculus I",
          "category": "University Courses",
          "description": "Limits, derivatives, optimization, and integration basics with applied problem solving."
        },
        {
          "id": "course_hs_algebra",
          "title": "High School Algebra",
          "category": "High School Courses",
          "description": "Linear equations, functions, systems, polynomials, and graph interpretation."
        }
      ],
      "examPrepTracks": [
        {
          "id": "course_sat_math",
          "title": "SAT Math Prep",
          "category": "Exam Prep",
          "description": "Data analysis, algebra, geometry essentials, and timing tactics for SAT sections."
        }
      ],
      "reviews": [
        { "id": "review_1", "name": "L.M.", "rating": 5, "text": "Clear explanations and strong structure.", "status": "approved" },
        { "id": "review_2", "name": "A.K.", "rating": 5, "text": "Helped me improve quickly before exams.", "status": "approved" }
      ],
      "faq": [
        {
          "id": "faq_1",
          "question": "How are sessions structured?",
          "answer": "Sessions include concept review, guided practice, and action points for the next week."
        },
        {
          "id": "faq_2",
          "question": "Do you support exam preparation?",
          "answer": "Yes. IB/AP/SAT/A-Levels tracks are available with timed strategy training."
        }
      ]
    }
    $json$::jsonb
  ),
  (
    'selectable_options',
    $json$
    {
      "contactMethods": ["Email", "Phone", "WhatsApp"],
      "serviceTypes": ["High School", "University", "Exam Prep"],
      "urgencyWindows": ["Within 2 weeks", "Within 1 month", "Within 3 months"],
      "urgencyFlags": ["No", "Yes"],
      "assessmentSubjects": ["Math", "Physics", "Both"],
      "courseCategories": ["University Courses", "High School Courses", "Exam Prep"]
    }
    $json$::jsonb
  )
on conflict (key) do update
  set content = excluded.content;

-- -----------------------------------------------------------------------------
-- Learner courses for the dev student
-- -----------------------------------------------------------------------------
insert into public.learner_courses (student_id, course_id, status)
values
  ('user_dev_student', 'course_calculus_1', 'in-progress'),
  ('user_dev_student', 'course_hs_algebra', 'passed')
on conflict (student_id, course_id) do nothing;

-- -----------------------------------------------------------------------------
-- Session requests: one from the dev student (accepted, bookable) and one from
-- a guest (new).
-- -----------------------------------------------------------------------------
insert into public.session_requests (
  id, student_id, name, email, phone, contact_method, subject, service_type,
  urgency_window, is_urgent, hard_topics, preferred_slot, earliest_date,
  message, consultation, status
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'user_dev_student',
    'Student User',
    'student@local.test',
    '+1 555 0100',
    'Email',
    'Math',
    'University',
    'Within 2 weeks',
    true,
    'Integration by parts, Series convergence',
    'Weekday evenings',
    current_date + 3,
    'Midterm in two weeks, need help with the integration unit.',
    false,
    'accepted'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    null,
    'Guest Visitor',
    'guest@local.test',
    null,
    'Phone',
    'Physics',
    'High School',
    'Within 1 month',
    false,
    '',
    'Weekends',
    null,
    'Looking for weekly physics support.',
    true,
    'new'
  )
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- A placement assessment for the dev student
-- -----------------------------------------------------------------------------
insert into public.assessments (id, student_id, subject, answers, score, total, recommendation)
values (
  '00000000-0000-4000-8000-000000000101',
  'user_dev_student',
  'Math',
  '{"q1": "b", "q2": "d", "q3": "a"}'::jsonb,
  2,
  3,
  'Calculus I'
)
on conflict (id) do nothing;
