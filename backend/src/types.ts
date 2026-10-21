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

export interface AboutStat {
  id: string;
  value: string;
  label: string;
}

/** The tutor's public profile: hero copy, bio, contact details and headline numbers. */
export interface About {
  tutorName: string;
  headline: string;
  tagline: string;
  bio: string;
  email: string;
  phone: string;
  location: string;
  photoUrl: string;
  /** YouTube/Vimeo link or a direct video file URL; empty hides the video. */
  videoUrl: string;
  stats: AboutStat[];
  /** Credentials and selling points, one line each. */
  highlights: string[];
}

export interface SiteContent {
  about: About;
  courses: Course[];
  examPrepTracks: Course[];
  reviews: Review[];
  faq: FaqItem[];
  selectableOptions: SelectableOptions;
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
  /** Calendly invitee links; null for bookings synced before they were stored. */
  cancelUrl: string | null;
  rescheduleUrl: string | null;
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

export const RESOURCE_KINDS = ['file', 'link', 'video'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_VISIBILITIES = ['public', 'students', 'private'] as const;
export type ResourceVisibility = (typeof RESOURCE_VISIBILITIES)[number];

export interface Resource {
  id: string;
  title: string;
  description: string;
  kind: ResourceKind;
  /** Link/video target; null for files (use GET /resources/:id/download). */
  url: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  subject: string;
  courseId: string | null;
  visibility: ResourceVisibility;
  /** Admin only: who a `private` resource is shared with. Empty for other viewers. */
  studentIds: string[];
  featured: boolean;
  createdAt: string;
}
