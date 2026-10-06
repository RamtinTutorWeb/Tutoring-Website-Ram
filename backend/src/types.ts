// API shapes from docs/ARCHITECTURE.md. camelCase on the wire; db.ts maps to snake_case columns.

export type Role = 'student' | 'admin';

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: Role;
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  category: string;
  description: string;
}

export const REVIEW_STATUSES = ['pending', 'approved'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface Review {
  id: string;
  name: string;
  rating: number;
  text: string;
  status?: ReviewStatus;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const SELECTABLE_OPTION_KEYS = [
  'contactMethods',
  'serviceTypes',
  'urgencyWindows',
  'urgencyFlags',
  'assessmentSubjects',
  'courseCategories',
] as const;

export type SelectableOptionKey = (typeof SELECTABLE_OPTION_KEYS)[number];
export type SelectableOptions = Record<SelectableOptionKey, string[]>;

/** A heading + paragraph block (About and Policy pages). */
export interface TextSection {
  id: string;
  heading: string;
  body: string;
}

/** Admin-editable page copy and site settings, stored in site_settings 'pages'. */
export interface SitePages {
  home: {
    kicker: string;
    title: string;
    subtitle: string;
    teachingTitle: string;
    teachingText: string;
    /** YouTube/Vimeo link or a direct .mp4 URL; empty hides the video. */
    videoUrl: string;
  };
  about: { title: string; intro: string; photoUrl: string; sections: TextSection[] };
  examPrep: { intro: string; timelinesTitle: string; timelinesText: string };
  policy: { intro: string; sections: TextSection[] };
  contact: { intro: string; email: string; phone: string };
  /** Calendly event link used by /book; empty falls back to the VITE_CALENDLY_URL build var. */
  booking: { calendlyUrl: string; intro: string };
}

export const PAGE_KEYS = ['home', 'about', 'examPrep', 'policy', 'contact', 'booking'] as const;

export interface SiteContent {
  courses: Course[];
  examPrepTracks: Course[];
  reviews: Review[];
  faq: FaqItem[];
  selectableOptions: SelectableOptions;
  pages: SitePages;
}

export const REQUEST_STATUSES = ['new', 'accepted', 'declined', 'scheduled', 'closed'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface NewRequest {
  name: string;
  email: string;
  phone?: string;
  contactMethod?: string;
  serviceType?: string;
  subject?: string;
  urgencyWindow?: string;
  isUrgent?: boolean;
  hardTopics?: string;
  preferredSlot?: string;
  /** YYYY-MM-DD */
  earliestDate?: string;
  message?: string;
  consultation?: boolean;
}

export interface SessionRequest extends Required<Omit<NewRequest, 'isUrgent' | 'consultation'>> {
  id: string;
  studentId: string | null;
  isUrgent: boolean;
  consultation: boolean;
  status: RequestStatus;
  createdAt: string;
}

export type BookingStatus = 'scheduled' | 'canceled';

export interface Booking {
  id: string;
  studentId: string | null;
  requestId: string | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
  eventTypeName: string | null;
  startAt: string | null;
  endAt: string | null;
  status: BookingStatus;
  cancelReason: string | null;
}

export const COURSE_STATUSES = ['registered', 'in-progress', 'passed'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export interface LearnerCourse {
  id: string;
  studentId: string;
  courseId: string;
  status: CourseStatus;
  registeredAt: string;
}

export interface Assessment {
  id: string;
  studentId: string;
  subject: string | null;
  answers: unknown;
  score: number | null;
  total: number | null;
  recommendation: string | null;
  createdAt: string;
}
