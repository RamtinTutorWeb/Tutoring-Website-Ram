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

export interface Review {
  id: string;
  name: string;
  rating: number;
  text: string;
  status?: 'pending' | 'approved';
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

export interface SiteContent {
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
