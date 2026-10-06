import { PAGE_KEYS, SELECTABLE_OPTION_KEYS, type Course, type SelectableOptions, type SitePages } from '../types.js';

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

/** Starting copy for every editable page. Stored pages are merged over these field by field. */
export const DEFAULT_PAGES: SitePages = {
  home: {
    kicker: 'Math and Physics Tutoring',
    title: 'Ace math and physics with expert tutoring',
    subtitle: 'Personalized support for University, IB, AP, SAT, and A-Level students.',
    teachingTitle: 'Teaching style',
    teachingText:
      'Concept-first teaching with targeted practice. We break topics into manageable steps, ' +
      'identify gaps quickly, and build confidence through structured solving strategies.',
    videoUrl: '',
  },
  about: {
    title: 'About me',
    intro: 'A little about my background and how I teach.',
    photoUrl: '',
    sections: [
      { id: 'about_education', heading: 'Education', body: 'Add your degrees, schools, and any certifications here.' },
      { id: 'about_style', heading: 'Teaching style', body: 'Describe how a typical session runs and what students can expect.' },
      { id: 'about_experience', heading: 'Experience', body: 'Years tutoring, levels and exams you cover, and student results.' },
    ],
  },
  examPrep: {
    intro: 'Dedicated tracks for exam strategy, topic targeting, timed practice, and mock sessions.',
    timelinesTitle: 'However close your exam is',
    timelinesText: 'Tell me when your exam is and I will plan sessions around the time you have left.',
  },
  policy: {
    intro: '',
    sections: [
      {
        id: 'policy_sessions',
        heading: 'Sessions',
        body:
          'Send a tutoring request first. Once it is accepted you will receive a link to book a time through the online scheduler.\n\n' +
          'Cancellations and changes should be made as early as possible using the links in your booking confirmation email.',
      },
      {
        id: 'policy_accounts',
        heading: 'Accounts',
        body:
          'Users are responsible for keeping login information private. Password resets and sign-in methods are managed from your account menu.\n\n' +
          'Course progress and request details are used only to support tutoring operations.',
      },
    ],
  },
  contact: {
    intro: 'Tell me what you need help with. Once your request is accepted you will get a link to book a session.',
    email: '',
    phone: '',
  },
  booking: { calendlyUrl: '', intro: 'Pick a time that works for you.' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every page and field present: stored strings/arrays win, anything missing or mistyped uses the default. */
export function normalizePages(stored: unknown): SitePages {
  const source = isRecord(stored) ? stored : {};
  const pages = {} as Record<string, Record<string, unknown>>;
  for (const key of PAGE_KEYS) {
    const defaults = DEFAULT_PAGES[key] as unknown as Record<string, unknown>;
    const page = isRecord(source[key]) ? source[key] : {};
    pages[key] = Object.fromEntries(
      Object.entries(defaults).map(([field, fallback]) => {
        const value = page[field];
        const ok = Array.isArray(fallback) ? Array.isArray(value) : typeof value === typeof fallback;
        return [field, ok ? value : fallback];
      }),
    );
  }
  return pages as unknown as SitePages;
}
