-- =============================================================================
-- TutorPro dev seed
-- Applied automatically by `supabase start` / `supabase db reset` (local only).
-- Never run against production: profile ids are placeholders, not real Clerk
-- user ids. To act as these users locally, mint a Clerk dev JWT whose `sub`
-- matches, or swap the ids below for your real Clerk user ids.
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
-- Shapes mirror frontend/src/types.ts (Course, Review, FaqItem,
-- SelectableOptions, SessionSettings).
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
  ),
  (
    'session_settings',
    $json$
    {
      "defaultDailySlots": 8,
      "slotDurationMinutes": 60,
      "dayStartHour": 8,
      "dayEndHour": 20,
      "sessionTypes": [
        { "id": "session_type_support", "purpose": "Course Support", "durationMinutes": 60 },
        { "id": "session_type_exam", "purpose": "Exam Prep", "durationMinutes": 120 },
        { "id": "session_type_assessment", "purpose": "Assessment Review", "durationMinutes": 180 }
      ]
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
-- One open session request
-- -----------------------------------------------------------------------------
insert into public.session_requests (
  id, student_id, subject, service_type, urgency_window, is_urgent,
  hard_topics, preferred_slot, earliest_date, message, status
)
values (
  '00000000-0000-4000-8000-000000000001',
  'user_dev_student',
  'Math',
  'University',
  'Within 2 weeks',
  true,
  array['Integration by parts', 'Series convergence'],
  'Weekday evenings',
  current_date + 3,
  'Midterm in two weeks, need help with the integration unit.',
  'open'
)
on conflict (id) do nothing;
