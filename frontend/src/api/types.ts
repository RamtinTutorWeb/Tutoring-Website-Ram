// Frontend copy of the HTTP contract in docs/ARCHITECTURE.md. Keep in sync with backend/.

export type Role = "student" | "admin";

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
  status?: "pending" | "approved";
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export type SelectableOptionKey =
  | "contactMethods"
  | "serviceTypes"
  | "urgencyWindows"
  | "urgencyFlags"
  | "assessmentSubjects"
  | "courseCategories";

export type SelectableOptions = Record<SelectableOptionKey, string[]>;

/** A heading + paragraph block (About and Policy pages). */
export interface TextSection {
  id: string;
  heading: string;
  body: string;
}

/** Admin-editable page copy and site settings. */
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
  /** Calendly event link used by /book; empty falls back to VITE_CALENDLY_URL. */
  booking: { calendlyUrl: string; intro: string };
}

export type PageKey = keyof SitePages;

export interface SiteContent {
  courses: Course[];
  examPrepTracks: Course[];
  reviews: Review[];
  faq: FaqItem[];
  selectableOptions: SelectableOptions;
  pages: SitePages;
}

export type RequestStatus = "new" | "accepted" | "declined" | "scheduled" | "closed";

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

export interface SessionRequest extends Required<Omit<NewRequest, "isUrgent" | "consultation">> {
  id: string;
  studentId: string | null;
  isUrgent: boolean;
  consultation: boolean;
  status: RequestStatus;
  createdAt: string;
}

export interface Booking {
  id: string;
  studentId: string | null;
  requestId: string | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
  eventTypeName: string | null;
  startAt: string | null;
  endAt: string | null;
  status: "scheduled" | "canceled";
  cancelReason: string | null;
}

export type CourseStatus = "registered" | "in-progress" | "passed";

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

export interface NewAssessment {
  subject: string;
  answers: unknown;
  score: number;
  total: number;
  recommendation: string;
}

export interface NewReview {
  /** 1-5 */
  rating: number;
  text: string;
  /** Defaults to the profile's fullName on the backend. */
  name?: string;
}
