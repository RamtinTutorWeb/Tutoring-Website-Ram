import { SELECTABLE_OPTION_KEYS, type Course, type SelectableOptions } from '../types.js';

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
