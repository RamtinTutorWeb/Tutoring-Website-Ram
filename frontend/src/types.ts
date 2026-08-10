export type Role = "visitor" | "student" | "parent" | "tutor" | "admin";
export type Route = "home" | "courses" | "exam-prep" | "assessment" | "contact" | "login" | "dashboard" | "policy";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Exclude<Role, "visitor">;
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

export interface Course {
  id: string;
  title: string;
  category: string;
  description: string;
}

export type CourseProgressStatus = "registered" | "in-progress" | "passed";

export interface LearnerCourseRecord {
  id: string;
  userId: string;
  courseId: string;
  status: CourseProgressStatus;
  registeredAt: string;
}

export type SessionSlotStatus = "available" | "reserved";

export interface SessionSlot {
  id: string;
  tutorId: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose?: string;
  status: SessionSlotStatus;
  learnerName?: string;
  notes?: string;
}

export interface SessionType {
  id: string;
  purpose: string;
  durationMinutes: number;
}

export interface SessionSettings {
  defaultDailySlots: number;
  slotDurationMinutes: number;
  dayStartHour: number;
  dayEndHour: number;
  sessionTypes: SessionType[];
}

export type SelectableOptionKey =
  | "contactMethods"
  | "serviceTypes"
  | "urgencyWindows"
  | "urgencyFlags"
  | "assessmentSubjects"
  | "courseCategories";

export type SelectableOptions = Record<SelectableOptionKey, string[]>;

export interface BookingRequest {
  id: string;
  userId: string | null;
  name: string;
  contactMethod: string;
  email: string;
  phone: string;
  serviceType: string;
  subject: string;
  urgencyWindow: string;
  isUrgent: string;
  hardTopics: string;
  preferredSlot: string;
  earliestDate: string;
  message: string;
  consultation: boolean;
  status: "new" | "replied" | "closed";
  createdAt: string;
}

export interface Questionnaire {
  id: string;
  userId: string;
  grade: string;
  subject: string;
  goal: string;
  createdAt: string;
}

export interface TestRecord {
  id: string;
  userId: string;
  answers: number[];
  explanations: string[];
  score: number;
  total: number;
  recommendation: string;
  createdAt: string;
}

export interface TestQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  recommendationTag: string;
}

export interface DB {
  users: User[];
  currentUserId: string | null;
  selectableOptions: SelectableOptions;
  reviews: Review[];
  faq: FaqItem[];
  courses: Course[];
  examPrepTracks: Course[];
  learnerCourses: LearnerCourseRecord[];
  sessionSlots: SessionSlot[];
  sessionSettings: SessionSettings;
  requests: BookingRequest[];
  questionnaires: Questionnaire[];
  tests: TestRecord[];
}
