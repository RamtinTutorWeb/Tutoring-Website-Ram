import {
  SELECTABLE_OPTION_KEYS,
  type About,
  type AboutStat,
  type AssessmentQuestion,
  type Course,
  type PolicySection,
  type SelectableOptions,
} from '../types.js';

// Ported from the old settingsRouter: defaults and normalization rules are unchanged.

export const EXAM_PREP_CATEGORY = 'Exam Prep';

export const DEFAULT_SELECTABLE_OPTIONS: SelectableOptions = {
  contactMethods: ['Email', 'Phone', 'WhatsApp'],
  serviceTypes: ['High School', 'University', 'Exam Prep'],
  urgencyWindows: ['Within 2 weeks', 'Within 1 month', 'Within 3 months'],
  urgencyFlags: ['No', 'Yes'],
  assessmentSubjects: ['Math', 'Physics', 'Both'],
  courseCategories: ['University Courses', 'High School Courses', 'Exam Prep'],
};

/** Every key present, values trimmed, inner whitespace collapsed, blanks and duplicates removed. */
export function normalizeOptions(options: Partial<Record<string, unknown>> | null | undefined): SelectableOptions {
  const normalized = {} as SelectableOptions;
  for (const key of SELECTABLE_OPTION_KEYS) {
    const raw = options?.[key];
    const values = Array.isArray(raw) ? raw : DEFAULT_SELECTABLE_OPTIONS[key];
    normalized[key] = [
      ...new Set(values.map((value) => String(value).trim().replace(/\s+/g, ' ')).filter(Boolean)),
    ];
  }
  return normalized;
}

/**
 * Courses and exam prep tracks are one catalog split by category: anything in
 * the "Exam Prep" category lives in examPrepTracks. Dedupes by id (last wins).
 */
export function normalizeCatalog(
  courses: Course[] | undefined,
  examPrepTracks: Course[] | undefined,
): { courses: Course[]; examPrepTracks: Course[] } {
  const byId = new Map<string, Course>();
  for (const course of [...(courses ?? []), ...(examPrepTracks ?? [])]) {
    if (course?.id) byId.set(course.id, course);
  }
  const items = [...byId.values()];
  return {
    courses: items.filter((c) => c.category !== EXAM_PREP_CATEGORY),
    examPrepTracks: items.filter((c) => c.category === EXAM_PREP_CATEGORY),
  };
}

/** Shown until the tutor fills in Settings > Tutor Profile. */
export const DEFAULT_ABOUT: About = {
  tutorName: 'Ramtin',
  headline: 'Math & physics, finally making sense.',
  tagline:
    'One-to-one tutoring for University, IB, AP, SAT and A-Level students. Concept-first lessons, targeted practice and exam strategy that sticks.',
  bio: 'I tutor mathematics and physics from high school through university level. Every plan starts with a short assessment, so sessions go straight to the gaps that cost marks. Students leave each lesson with worked notes, practice sets and a clear next step.',
  email: '',
  phone: '',
  location: 'Online & in person',
  photoUrl: '',
  videoUrl: '',
  // No default numbers: the site must not advertise figures the tutor hasn't entered.
  stats: [],
  highlights: [
    'Free consultation before you commit',
    'Personal study plan after the first session',
    'Notes and practice sets shared after every lesson',
  ],
};

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

/** Fills missing fields from DEFAULT_ABOUT; drops malformed stats and blank highlights. */
export function normalizeAbout(raw: unknown): About {
  const about = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof About, unknown>>;
  const stats = Array.isArray(about.stats)
    ? (about.stats as Partial<AboutStat>[])
        .filter((s) => s && typeof s.id === 'string' && typeof s.value === 'string' && typeof s.label === 'string')
        .map((s) => ({ id: s.id!, value: s.value!.trim(), label: s.label!.trim() }))
        .filter((s) => s.value || s.label)
    : DEFAULT_ABOUT.stats;
  const highlights = Array.isArray(about.highlights)
    ? about.highlights.map((h) => String(h).trim()).filter(Boolean)
    : DEFAULT_ABOUT.highlights;
  return {
    tutorName: text(about.tutorName, DEFAULT_ABOUT.tutorName),
    headline: text(about.headline, DEFAULT_ABOUT.headline),
    tagline: text(about.tagline, DEFAULT_ABOUT.tagline),
    bio: text(about.bio, DEFAULT_ABOUT.bio),
    email: text(about.email, DEFAULT_ABOUT.email),
    phone: text(about.phone, DEFAULT_ABOUT.phone),
    location: text(about.location, DEFAULT_ABOUT.location),
    photoUrl: text(about.photoUrl, DEFAULT_ABOUT.photoUrl),
    videoUrl: text(about.videoUrl, DEFAULT_ABOUT.videoUrl),
    stats,
    highlights,
  };
}

/** The original placement test, used until the tutor edits it (Settings > Assessment). */
export const DEFAULT_ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  { id: 'q1', text: 'If 2x + 5 = 17, what is x?', options: ['4', '5', '6', '8'], correctIndex: 2, topic: 'Algebra Foundations' },
  { id: 'q2', text: 'What is sin(30°)?', options: ['1', '1/2', '√2/2', '√3/2'], correctIndex: 1, topic: 'Trigonometry Basics' },
  { id: 'q3', text: 'Sequence: 3, 6, 12, 24, ... next value?', options: ['30', '36', '42', '48'], correctIndex: 3, topic: 'Patterns and Sequences' },
  {
    id: 'q4',
    text: 'A car accelerates uniformly from rest to 20 m/s in 4 s. What is its acceleration?',
    options: ['4 m/s²', '5 m/s²', '16 m/s²', '80 m/s²'],
    correctIndex: 1,
    topic: 'Kinematics',
  },
  { id: 'q5', text: 'What is the derivative of x³?', options: ['x²', '3x', '3x²', 'x⁴/4'], correctIndex: 2, topic: 'Calculus Foundations' },
];

/** Defaults when never saved; drops questions without text, two options, or a valid answer. */
export function normalizeQuestions(raw: unknown): AssessmentQuestion[] {
  if (!Array.isArray(raw)) return DEFAULT_ASSESSMENT_QUESTIONS;
  return (raw as Partial<AssessmentQuestion>[])
    .filter((q) => q && typeof q.id === 'string' && typeof q.text === 'string' && Array.isArray(q.options))
    .map((q) => ({
      id: q.id!,
      text: q.text!.trim(),
      options: q.options!.map((o) => String(o).trim()).filter(Boolean),
      correctIndex: Number(q.correctIndex),
      topic: typeof q.topic === 'string' ? q.topic.trim() : '',
    }))
    .filter((q) => q.text && q.options.length >= 2 && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length);
}

/** Shown on /policy until the tutor writes their own (Settings > Policies). */
export const DEFAULT_POLICY_SECTIONS: PolicySection[] = [
  {
    id: 'policy-sessions',
    title: 'Session Policy',
    body: 'Send a tutoring request first. Once it is accepted you will receive a link to book a time through our online scheduler.\n\nCancellations and changes should be made as early as possible using the links in your booking confirmation email.',
  },
  {
    id: 'policy-account',
    title: 'Account Policy',
    body: 'Users are responsible for keeping login information private. Password resets and sign-in methods are managed from your account menu.\n\nCourse progress and request details are used only to support tutoring operations.',
  },
];

export function normalizePolicySections(raw: unknown): PolicySection[] {
  if (!Array.isArray(raw)) return DEFAULT_POLICY_SECTIONS;
  return (raw as Partial<PolicySection>[])
    .filter((p) => p && typeof p.id === 'string' && typeof p.title === 'string' && typeof p.body === 'string')
    .map((p) => ({ id: p.id!, title: p.title!.trim(), body: p.body!.trim() }))
    .filter((p) => p.title || p.body);
}
