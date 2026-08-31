import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { testQuestions } from "../data/testQuestions";
import { apiClient } from "../clients/apiClient";
import { uid } from "../lib/id";
import { loadDB, saveDB } from "../lib/storage";
import type { Course, CourseProgressStatus, DB, LearnerCourseRecord, SelectableOptionKey, SelectableOptions, SessionSettings, SessionSlot, SessionSlotStatus, SessionType, User } from "../types";

interface ContactPayload {
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
}

interface QuestionnairePayload {
  grade: string;
  subject: string;
  goal: string;
}

interface SignupPayload {
  name: string;
  email: string;
  password: string;
  role: User["role"];
  adminSignupCode?: string;
}

interface BackendUser {
  _id: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  email: string;
  phone?: string;
  role: "learner" | "alumni" | "admin";
}

interface LoginResponse {
  token: string;
  dbUser: BackendUser;
}

type SharedContent = Pick<DB, "courses" | "examPrepTracks" | "reviews" | "faq" | "learnerCourses" | "sessionSlots" | "sessionSettings" | "requests">;

interface SettingsResponse {
  message?: string;
  selectableOptions: SelectableOptions;
  content?: Partial<SharedContent>;
}

interface AppContextValue {
  db: DB;
  currentUser: User | null;
  canUseAssessment: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signup: (payload: SignupPayload) => Promise<{ ok: boolean; message: string }>;
  logout: () => void;
  updatePhone: (phone: string) => Promise<{ ok: boolean; message: string }>;
  submitContact: (payload: ContactPayload) => { ok: boolean; message: string };
  submitQuestionnaire: (payload: QuestionnairePayload) => void;
  submitTest: (answers: number[], explanations: string[]) => { score: number; total: number; recommendation: string };
  updateRequestStatus: (requestId: string, status: "replied" | "closed") => void;
  addCourse: (course: Omit<Course, "id">) => void;
  updateCourse: (courseId: string, course: Omit<Course, "id">) => void;
  deleteCourse: (courseId: string) => void;
  addExamPrepTrack: (course: Omit<Course, "id">) => void;
  updateExamPrepTrack: (courseId: string, course: Omit<Course, "id">) => void;
  deleteExamPrepTrack: (courseId: string) => void;
  assignCourseToLearner: (payload: Omit<LearnerCourseRecord, "id" | "registeredAt">) => { ok: boolean; message: string };
  updateLearnerCourseStatus: (recordId: string, status: CourseProgressStatus) => void;
  deleteLearnerCourse: (recordId: string) => void;
  addSessionSlot: (slot: Omit<SessionSlot, "id">) => { ok: boolean; message: string };
  updateSessionSlotStatus: (slotId: string, status: SessionSlotStatus) => void;
  reserveSessionSlot: (slotId: string, learnerName: string, notes?: string, courseId?: string, courseTitle?: string) => void;
  deleteSessionSlot: (slotId: string) => void;
  updateSessionSettings: (settings: SessionSettings) => void;
  createTutor: (payload: { name: string; email: string; password: string }) => Promise<{ ok: boolean; message: string }>;
  resetLearnerAccount: (email: string) => Promise<{ ok: boolean; message: string }>;
  addReview: (name: string, rating: number, text: string) => void;
  addPendingReview: (name: string, rating: number, text: string) => void;
  approveReview: (reviewId: string) => void;
  deleteReview: (reviewId: string) => void;
  addFaq: (question: string, answer: string) => void;
  deleteFaq: (faqId: string) => void;
  addSelectableOption: (key: SelectableOptionKey, value: string) => Promise<{ ok: boolean; message: string }>;
  updateSelectableOption: (key: SelectableOptionKey, index: number, value: string) => Promise<{ ok: boolean; message: string }>;
  deleteSelectableOption: (key: SelectableOptionKey, index: number) => Promise<{ ok: boolean; message: string }>;
}

const AppContext = createContext<AppContextValue | null>(null);

function cloneDB(db: DB): DB {
  return JSON.parse(JSON.stringify(db)) as DB;
}

function toBackendRole(role: User["role"]): "learner" | "alumni" | "admin" {
  if (role === "tutor") return "alumni";
  if (role === "admin") return "admin";
  return "learner";
}

function toFrontendRole(role: BackendUser["role"]): User["role"] {
  if (role === "alumni") return "tutor";
  if (role === "admin") return "admin";
  return "student";
}

function backendUserToFrontendUser(user: BackendUser): User {
  const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();
  return {
    id: user._id,
    name: fullName || user.username || user.email,
    email: user.email,
    phone: user.phone ?? "",
    password: "",
    role: toFrontendRole(user.role)
  };
}

function splitName(name: string): { firstname: string; lastname: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstname: parts[0] ?? "",
    lastname: parts.slice(1).join(" ")
  };
}

function cleanOption(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function notifySessionRequest(payload: {
  learnerName: string;
  tutorId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}): void {
  apiClient.post("/settings/session-request-notification", payload).catch((err) => {
    console.warn("Failed to send session request notification:", err);
  });
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function slotsOverlap(a: Pick<SessionSlot, "startTime" | "endTime">, b: Pick<SessionSlot, "startTime" | "endTime">): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

function defaultSessionTypes(): SessionType[] {
  return [
    { id: "session-type-course-support", purpose: "Course Support", durationMinutes: 60 },
    { id: "session-type-exam-prep", purpose: "Exam Prep", durationMinutes: 120 },
    { id: "session-type-assessment-review", purpose: "Assessment Review", durationMinutes: 180 }
  ];
}

function normalizeSessionDuration(durationMinutes?: number): 60 | 120 | 180 {
  if (durationMinutes === 120 || durationMinutes === 180) return durationMinutes;
  return 60;
}

function normalizeSessionSettings(settings?: Partial<SessionSettings>): SessionSettings {
  const sessionTypes = settings?.sessionTypes?.length ? settings.sessionTypes : defaultSessionTypes();
  return {
    defaultDailySlots: Math.max(1, Math.round(settings?.defaultDailySlots ?? 8)),
    slotDurationMinutes: normalizeSessionDuration(settings?.slotDurationMinutes),
    dayStartHour: Math.min(23, Math.max(0, Math.round(settings?.dayStartHour ?? 8))),
    dayEndHour: Math.min(24, Math.max(1, Math.round(settings?.dayEndHour ?? 20))),
    sessionTypes: sessionTypes.map((type) => ({
      id: type.id || uid(),
      purpose: type.purpose.trim() || "Tutoring Session",
      durationMinutes: normalizeSessionDuration(type.durationMinutes)
    }))
  };
}

function isSlotLocked(slot: Pick<SessionSlot, "date" | "startTime">): boolean {
  const sessionDate = new Date(`${slot.date}T${slot.startTime}:00`);
  return sessionDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDB] = useState<DB>(() => loadDB());
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const currentUser = useMemo(() => db.users.find((u) => u.id === db.currentUserId) ?? null, [db.users, db.currentUserId]);
  const canUseAssessment = currentUser?.role !== "admin";

  useEffect(() => {
    saveDB(db);
  }, [db]);

  useEffect(() => {
    let cancelled = false;

    apiClient.get<SettingsResponse>("/settings")
      .then((response) => {
        if (cancelled) return;
        updateDB((draft) => {
          draft.selectableOptions = response.data.selectableOptions;
          if (response.data.content) {
            draft.courses = response.data.content.courses?.length ? response.data.content.courses : draft.courses;
            draft.examPrepTracks = response.data.content.examPrepTracks?.length ? response.data.content.examPrepTracks : draft.examPrepTracks;
            draft.reviews = response.data.content.reviews?.length ? response.data.content.reviews : draft.reviews;
            draft.faq = response.data.content.faq?.length ? response.data.content.faq : draft.faq;
            draft.learnerCourses = response.data.content.learnerCourses ?? draft.learnerCourses;
            draft.sessionSlots = response.data.content.sessionSlots ?? draft.sessionSlots;
            draft.sessionSettings = normalizeSessionSettings(response.data.content.sessionSettings ?? draft.sessionSettings);
            draft.requests = response.data.content.requests ?? draft.requests;
          }
        });
        setSettingsLoaded(true);
      })
      .catch((err) => {
        console.warn("Failed to load site settings:", err);
        setSettingsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const refreshRequests = () => {
      apiClient.get<SettingsResponse>("/settings")
        .then((response) => {
          if (!response.data.content) return;
          const remoteRequests = response.data.content.requests;
          const remoteSlots = response.data.content.sessionSlots;
          updateDB((draft) => {
            if (remoteRequests && JSON.stringify(remoteRequests) !== JSON.stringify(draft.requests)) {
              draft.requests = remoteRequests;
            }
            if (remoteSlots && JSON.stringify(remoteSlots) !== JSON.stringify(draft.sessionSlots)) {
              draft.sessionSlots = remoteSlots;
            }
          });
        })
        .catch((err) => console.warn("Failed to refresh booking requests:", err));
    };

    const timer = window.setInterval(refreshRequests, 5000);
    return () => window.clearInterval(timer);
  }, [currentUser]);

  useEffect(() => {
    if (!settingsLoaded || !localStorage.getItem("peertrack_token")) return;

    const content: SharedContent = {
      courses: db.courses,
      examPrepTracks: db.examPrepTracks,
      reviews: db.reviews,
      faq: db.faq,
      learnerCourses: db.learnerCourses,
      sessionSlots: db.sessionSlots,
      sessionSettings: db.sessionSettings,
      requests: db.requests
    };

    const timer = window.setTimeout(() => {
      apiClient.put("/settings/content", { content }).catch((err) => {
        console.warn("Failed to sync shared content:", err);
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    db.courses,
    db.examPrepTracks,
    db.faq,
    db.learnerCourses,
    db.requests,
    db.reviews,
    db.sessionSettings,
    db.sessionSlots,
    settingsLoaded
  ]);

  function updateDB(mutator: (draft: DB) => void): void {
    setDB((prev) => {
      const draft = cloneDB(prev);
      mutator(draft);
      return draft;
    });
  }

  async function login(email: string, password: string): Promise<{ ok: boolean; message: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await apiClient.post<LoginResponse>("/users/login", {
        email: normalizedEmail,
        password
      });
      const user = backendUserToFrontendUser(response.data.dbUser);

      localStorage.setItem("peertrack_token", response.data.token);
      updateDB((draft) => {
        const existingIndex = draft.users.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
        if (existingIndex >= 0) {
          draft.users[existingIndex] = user;
        } else {
          draft.users.push(user);
        }
        draft.currentUserId = user.id;
      });

      return { ok: true, message: "Logged in successfully." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Login failed." };
    }
  }

  async function signup(payload: SignupPayload): Promise<{ ok: boolean; message: string }> {
    const email = payload.email.trim().toLowerCase();
    const { firstname, lastname } = splitName(payload.name);
    const username = email.split("@")[0] || `user_${uid()}`;

    try {
      await apiClient.post<{ message: string }>("/users/register", {
        username,
        email,
        password: payload.password,
        role: toBackendRole(payload.role),
        adminSignupCode: payload.adminSignupCode,
        firstname,
        lastname
      });

      const loginResult = await login(email, payload.password);
      if (!loginResult.ok) return loginResult;

      return { ok: true, message: "Account created and logged in." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Signup failed." };
    }
  }

  function logout(): void {
    localStorage.removeItem("peertrack_token");
    updateDB((draft) => {
      draft.currentUserId = null;
    });
  }

  async function updatePhone(phone: string): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await apiClient.put<{ phone: string }>("/users/me/profile", { phone });
      updateDB((draft) => {
        const user = draft.users.find((item) => item.id === draft.currentUserId);
        if (user) user.phone = response.data.phone;
      });
      return { ok: true, message: "Phone number updated." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Could not update phone number." };
    }
  }

  function submitContact(payload: ContactPayload): { ok: boolean; message: string } {
    const email = payload.email.trim();
    if (!/.+@.+\..+/.test(email)) {
      return { ok: false, message: "Please enter a valid email." };
    }

    updateDB((draft) => {
      draft.requests.push({
        id: uid(),
        userId: currentUser?.id ?? null,
        name: payload.name,
        contactMethod: payload.contactMethod,
        email,
        phone: payload.phone,
        serviceType: payload.serviceType,
        subject: payload.subject,
        urgencyWindow: payload.urgencyWindow,
        isUrgent: payload.isUrgent,
        hardTopics: payload.hardTopics,
        preferredSlot: payload.preferredSlot,
        earliestDate: payload.earliestDate,
        message: payload.message,
        consultation: payload.consultation,
        status: "new",
        createdAt: new Date().toISOString()
      });
    });

    return { ok: true, message: "Request submitted successfully." };
  }

  function submitQuestionnaire(payload: QuestionnairePayload): void {
    if (!currentUser) return;
    updateDB((draft) => {
      draft.questionnaires.push({
        id: uid(),
        userId: currentUser.id,
        grade: payload.grade,
        subject: payload.subject,
        goal: payload.goal,
        createdAt: new Date().toISOString()
      });
    });
  }

  function submitTest(answers: number[], explanations: string[]): { score: number; total: number; recommendation: string } {
    if (!currentUser) return { score: 0, total: testQuestions.length, recommendation: "" };

    let score = 0;
    const tagScores: Record<string, number> = {};

    testQuestions.forEach((q, index) => {
      if (answers[index] === q.correctIndex) {
        score += 1;
        tagScores[q.recommendationTag] = (tagScores[q.recommendationTag] ?? 0) + 1;
      }
    });

    const recommendation =
      score === 0
        ? "Book a consultation to determine starting point"
        : Object.entries(tagScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Algebra Foundations";

    updateDB((draft) => {
      draft.tests.push({
        id: uid(),
        userId: currentUser.id,
        answers,
        explanations,
        score,
        total: testQuestions.length,
        recommendation,
        createdAt: new Date().toISOString()
      });
    });

    return { score, total: testQuestions.length, recommendation };
  }

  function updateRequestStatus(requestId: string, status: "replied" | "closed"): void {
    updateDB((draft) => {
      const req = draft.requests.find((r) => r.id === requestId);
      if (req) req.status = status;
    });
  }

  function addCourse(course: Omit<Course, "id">): void {
    updateDB((draft) => {
      const newCourse = { id: uid(), ...course };
      if (course.category === "Exam Prep") {
        draft.examPrepTracks.push(newCourse);
      } else {
        draft.courses.push(newCourse);
      }
    });
  }

  function updateCourse(courseId: string, course: Omit<Course, "id">): void {
    updateDB((draft) => {
      const existingCourse = draft.courses.find((item) => item.id === courseId)
        ?? draft.examPrepTracks.find((item) => item.id === courseId);
      if (!existingCourse) return;

      const updatedCourse = { id: courseId, ...course };
      draft.courses = draft.courses.filter((item) => item.id !== courseId);
      draft.examPrepTracks = draft.examPrepTracks.filter((item) => item.id !== courseId);
      if (course.category === "Exam Prep") {
        draft.examPrepTracks.push(updatedCourse);
      } else {
        draft.courses.push(updatedCourse);
      }
    });
  }

  function deleteCourse(courseId: string): void {
    updateDB((draft) => {
      draft.courses = draft.courses.filter((c) => c.id !== courseId);
      draft.examPrepTracks = draft.examPrepTracks.filter((c) => c.id !== courseId);
      draft.learnerCourses = draft.learnerCourses.filter((record) => record.courseId !== courseId);
    });
  }

  function addExamPrepTrack(course: Omit<Course, "id">): void {
    updateDB((draft) => {
      draft.examPrepTracks.push({ id: uid(), ...course });
    });
  }

  function updateExamPrepTrack(courseId: string, course: Omit<Course, "id">): void {
    updateDB((draft) => {
      const existingCourse = draft.examPrepTracks.find((item) => item.id === courseId);
      if (existingCourse) {
        existingCourse.title = course.title;
        existingCourse.category = course.category;
        existingCourse.description = course.description;
      }
    });
  }

  function deleteExamPrepTrack(courseId: string): void {
    updateDB((draft) => {
      draft.examPrepTracks = draft.examPrepTracks.filter((course) => course.id !== courseId);
      draft.learnerCourses = draft.learnerCourses.filter((record) => record.courseId !== courseId);
    });
  }

  function assignCourseToLearner(payload: Omit<LearnerCourseRecord, "id" | "registeredAt">): { ok: boolean; message: string } {
    if (!payload.userId) return { ok: false, message: "Please select a student." };
    if (!payload.courseId) return { ok: false, message: "Please select a course." };

    const alreadyAssigned = db.learnerCourses.some(
      (record) => record.userId === payload.userId && record.courseId === payload.courseId
    );
    if (alreadyAssigned) return { ok: false, message: "This course is already assigned to this student." };

    updateDB((draft) => {
      draft.learnerCourses.push({
        id: uid(),
        ...payload,
        registeredAt: new Date().toISOString()
      });
    });

    return { ok: true, message: "Course assigned to student." };
  }

  function updateLearnerCourseStatus(recordId: string, status: CourseProgressStatus): void {
    updateDB((draft) => {
      const record = draft.learnerCourses.find((item) => item.id === recordId);
      if (record) record.status = status;
    });
  }

  function deleteLearnerCourse(recordId: string): void {
    updateDB((draft) => {
      draft.learnerCourses = draft.learnerCourses.filter((record) => record.id !== recordId);
    });
  }

  function addSessionSlot(slot: Omit<SessionSlot, "id">): { ok: boolean; message: string } {
    if (!slot.tutorId) return { ok: false, message: "Please select an instructor." };
    if (!slot.date || !slot.startTime || !slot.endTime) {
      return { ok: false, message: "Please select date, start time, and duration." };
    }
    if (timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime)) {
      return { ok: false, message: "The session end time must be after the start time." };
    }
    const hasConflict = db.sessionSlots.some((existingSlot) => (
      existingSlot.tutorId === slot.tutorId &&
      existingSlot.date === slot.date &&
      slotsOverlap(existingSlot, slot)
    ));

    if (hasConflict) {
      return { ok: false, message: "This instructor already has a session during that time. Choose another time." };
    }

    updateDB((draft) => {
      const slotId = uid();
      draft.sessionSlots.push({ id: slotId, ...slot });
      if (slot.status === "reserved" && slot.learnerName) {
        draft.requests.push({
          id: uid(),
          userId: currentUser?.id ?? null,
          name: slot.learnerName,
          contactMethod: "Email",
          email: currentUser?.email ?? "",
          phone: "",
          serviceType: "Session Request",
          subject: slot.courseTitle || "Session reservation",
          urgencyWindow: "",
          isUrgent: "No",
          hardTopics: slot.purpose || "",
          preferredSlot: `${slot.date} ${slot.startTime}-${slot.endTime}`,
          earliestDate: slot.date,
          message: slot.notes || `Session reservation requested for ${slot.date} ${slot.startTime}-${slot.endTime}.`,
          consultation: true,
          status: "new",
          createdAt: new Date().toISOString()
        });
      }
    });

    if (slot.status === "reserved" && slot.learnerName) {
      notifySessionRequest({
        learnerName: slot.learnerName,
        tutorId: slot.tutorId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        notes: slot.notes
      });
    }

    return { ok: true, message: slot.status === "reserved" ? "Session reserved." : "Session slot added." };
  }

  function updateSessionSlotStatus(slotId: string, status: SessionSlotStatus): void {
    updateDB((draft) => {
      const slot = draft.sessionSlots.find((item) => item.id === slotId);
      if (!slot) return;
      if (slot.status === "reserved" && status === "available" && isSlotLocked(slot)) return;
      slot.status = status;
    });
  }

  function reserveSessionSlot(slotId: string, learnerName: string, notes = "", courseId = "", courseTitle = ""): void {
    updateDB((draft) => {
      const slot = draft.sessionSlots.find((item) => item.id === slotId);
      if (slot) {
        slot.status = "reserved";
        slot.learnerName = learnerName;
        slot.courseId = courseId;
        slot.courseTitle = courseTitle;
        if (notes.trim()) slot.notes = notes.trim();
        draft.requests.push({
          id: uid(),
          userId: currentUser?.id ?? null,
          name: learnerName,
          contactMethod: "Email",
          email: currentUser?.email ?? "",
          phone: "",
          serviceType: "Session Request",
          subject: courseTitle || "Session reservation",
          urgencyWindow: "",
          isUrgent: "No",
          hardTopics: slot.purpose || "",
          preferredSlot: `${slot.date} ${slot.startTime}-${slot.endTime}`,
          earliestDate: slot.date,
          message: notes.trim() || `Session reservation requested for ${slot.date} ${slot.startTime}-${slot.endTime}.`,
          consultation: true,
          status: "new",
          createdAt: new Date().toISOString()
        });
      }
    });

    const slot = db.sessionSlots.find((item) => item.id === slotId);
    if (slot) {
      notifySessionRequest({
        learnerName,
        tutorId: slot.tutorId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        notes
      });
    }
  }

  function deleteSessionSlot(slotId: string): void {
    updateDB((draft) => {
      draft.sessionSlots = draft.sessionSlots.filter((slot) => slot.id !== slotId || isSlotLocked(slot));
    });
  }

  function updateSessionSettings(settings: SessionSettings): void {
    updateDB((draft) => {
      draft.sessionSettings = normalizeSessionSettings(settings);
    });
  }

  async function createTutor(payload: { name: string; email: string; password: string }): Promise<{ ok: boolean; message: string }> {
    const email = payload.email.trim().toLowerCase();
    const { firstname, lastname } = splitName(payload.name);
    const username = email.split("@")[0] || `tutor_${uid()}`;

    try {
      await apiClient.post<{ message: string }>("/users/register", {
        username,
        email,
        password: payload.password,
        role: "alumni",
        firstname,
        lastname
      });

      updateDB((draft) => {
        const existingIndex = draft.users.findIndex((user) => user.email.toLowerCase() === email);
        const tutor: User = {
          id: `local-tutor-${uid()}`,
          name: payload.name.trim() || username,
          email,
          password: "",
          role: "tutor"
        };

        if (existingIndex >= 0) {
          draft.users[existingIndex] = { ...draft.users[existingIndex], ...tutor, id: draft.users[existingIndex].id };
        } else {
          draft.users.push(tutor);
        }
      });

      return { ok: true, message: "Tutor account created." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Failed to create tutor." };
    }
  }

  async function resetLearnerAccount(email: string): Promise<{ ok: boolean; message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return { ok: false, message: "Please enter the student email." };

    try {
      const response = await apiClient.post<{ message?: string }>("/users/forgot-password", { email: normalizedEmail });
      return { ok: true, message: response.data.message ?? "Password reset email requested." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Failed to request password reset." };
    }
  }

  function addReview(name: string, rating: number, text: string): void {
    updateDB((draft) => {
      draft.reviews.push({ id: uid(), name, rating, text, status: "approved" });
    });
  }

  function addPendingReview(name: string, rating: number, text: string): void {
    updateDB((draft) => {
      draft.reviews.push({ id: uid(), name, rating, text, status: "pending" });
    });
  }

  function approveReview(reviewId: string): void {
    updateDB((draft) => {
      const review = draft.reviews.find((item) => item.id === reviewId);
      if (review) review.status = "approved";
    });
  }

  function deleteReview(reviewId: string): void {
    updateDB((draft) => {
      draft.reviews = draft.reviews.filter((r) => r.id !== reviewId);
    });
  }

  function addFaq(question: string, answer: string): void {
    updateDB((draft) => {
      draft.faq.push({ id: uid(), question, answer });
    });
  }

  function deleteFaq(faqId: string): void {
    updateDB((draft) => {
      draft.faq = draft.faq.filter((f) => f.id !== faqId);
    });
  }

  async function saveSelectableOptions(selectableOptions: SelectableOptions): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await apiClient.put<SettingsResponse>("/settings/selectable-options", { selectableOptions });
      updateDB((draft) => {
        draft.selectableOptions = response.data.selectableOptions;
      });
      return { ok: true, message: response.data.message ?? "Options updated." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Failed to save options." };
    }
  }

  async function addSelectableOption(key: SelectableOptionKey, value: string): Promise<{ ok: boolean; message: string }> {
    const option = cleanOption(value);
    if (!option) return { ok: false, message: "Option value is required." };

    const existingOptions = db.selectableOptions[key] ?? [];
    if (existingOptions.some((item) => item.toLowerCase() === option.toLowerCase())) {
      return { ok: false, message: "Option already exists." };
    }

    return saveSelectableOptions({
      ...db.selectableOptions,
      [key]: [...existingOptions, option]
    });
  }

  async function updateSelectableOption(key: SelectableOptionKey, index: number, value: string): Promise<{ ok: boolean; message: string }> {
    const option = cleanOption(value);
    if (!option) return { ok: false, message: "Option value is required." };

    const existingOptions = db.selectableOptions[key] ?? [];
    if (existingOptions.some((item, itemIndex) => itemIndex !== index && item.toLowerCase() === option.toLowerCase())) {
      return { ok: false, message: "Option already exists." };
    }

    return saveSelectableOptions({
      ...db.selectableOptions,
      [key]: existingOptions.map((item, itemIndex) => (itemIndex === index ? option : item))
    });
  }

  async function deleteSelectableOption(key: SelectableOptionKey, index: number): Promise<{ ok: boolean; message: string }> {
    return saveSelectableOptions({
      ...db.selectableOptions,
      [key]: db.selectableOptions[key].filter((_, itemIndex) => itemIndex !== index)
    });
  }

  const value: AppContextValue = {
    db,
    currentUser,
    canUseAssessment,
    login,
    signup,
    logout,
    updatePhone,
    submitContact,
    submitQuestionnaire,
    submitTest,
    updateRequestStatus,
    addCourse,
    updateCourse,
    deleteCourse,
    addExamPrepTrack,
    updateExamPrepTrack,
    deleteExamPrepTrack,
    assignCourseToLearner,
    updateLearnerCourseStatus,
    deleteLearnerCourse,
    addSessionSlot,
    updateSessionSlotStatus,
    reserveSessionSlot,
    deleteSessionSlot,
    updateSessionSettings,
    createTutor,
    resetLearnerAccount,
    addReview,
    addPendingReview,
    approveReview,
    deleteReview,
    addFaq,
    deleteFaq,
    addSelectableOption,
    updateSelectableOption,
    deleteSelectableOption
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppProvider");
  return ctx;
}
