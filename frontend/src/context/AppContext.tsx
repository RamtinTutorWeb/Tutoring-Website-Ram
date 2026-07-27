import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { testQuestions } from "../data/testQuestions";
import { apiClient } from "../clients/apiClient";
import { uid } from "../lib/id";
import { loadDB, saveDB } from "../lib/storage";
import type { Course, CourseProgressStatus, DB, LearnerCourseRecord, SelectableOptionKey, SelectableOptions, SessionSettings, SessionSlot, SessionSlotStatus, User } from "../types";

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
}

interface BackendUser {
  _id: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  email: string;
  role: "learner" | "alumni" | "admin";
}

interface LoginResponse {
  token: string;
  dbUser: BackendUser;
}

interface SettingsResponse {
  message?: string;
  selectableOptions: SelectableOptions;
}

interface AppContextValue {
  db: DB;
  currentUser: User | null;
  canUseAssessment: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signup: (payload: SignupPayload) => Promise<{ ok: boolean; message: string }>;
  logout: () => void;
  submitContact: (payload: ContactPayload) => { ok: boolean; message: string };
  submitQuestionnaire: (payload: QuestionnairePayload) => void;
  submitTest: (answers: number[], explanations: string[]) => { score: number; total: number; recommendation: string };
  updateRequestStatus: (requestId: string, status: "replied" | "closed") => void;
  addCourse: (course: Omit<Course, "id">) => void;
  updateCourse: (courseId: string, course: Omit<Course, "id">) => void;
  deleteCourse: (courseId: string) => void;
  assignCourseToLearner: (payload: Omit<LearnerCourseRecord, "id" | "registeredAt">) => { ok: boolean; message: string };
  updateLearnerCourseStatus: (recordId: string, status: CourseProgressStatus) => void;
  deleteLearnerCourse: (recordId: string) => void;
  addSessionSlot: (slot: Omit<SessionSlot, "id">) => void;
  updateSessionSlotStatus: (slotId: string, status: SessionSlotStatus) => void;
  reserveSessionSlot: (slotId: string, learnerName: string, notes?: string) => void;
  deleteSessionSlot: (slotId: string) => void;
  updateSessionSettings: (settings: SessionSettings) => void;
  createTutor: (payload: { name: string; email: string; password: string }) => Promise<{ ok: boolean; message: string }>;
  resetLearnerAccount: (email: string) => Promise<{ ok: boolean; message: string }>;
  addReview: (name: string, rating: number, text: string) => void;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDB] = useState<DB>(() => loadDB());

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
        });
      })
      .catch((err) => {
        console.warn("Failed to load site settings:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentUser = useMemo(() => db.users.find((u) => u.id === db.currentUserId) ?? null, [db.users, db.currentUserId]);
  const canUseAssessment = currentUser?.role === "student" || currentUser?.role === "parent";

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
      draft.courses.push({ id: uid(), ...course });
    });
  }

  function updateCourse(courseId: string, course: Omit<Course, "id">): void {
    updateDB((draft) => {
      const existingCourse = draft.courses.find((item) => item.id === courseId);
      if (existingCourse) {
        existingCourse.title = course.title;
        existingCourse.category = course.category;
        existingCourse.description = course.description;
      }
    });
  }

  function deleteCourse(courseId: string): void {
    updateDB((draft) => {
      draft.courses = draft.courses.filter((c) => c.id !== courseId);
      draft.learnerCourses = draft.learnerCourses.filter((record) => record.courseId !== courseId);
    });
  }

  function assignCourseToLearner(payload: Omit<LearnerCourseRecord, "id" | "registeredAt">): { ok: boolean; message: string } {
    if (!payload.userId) return { ok: false, message: "Please select a learner." };
    if (!payload.courseId) return { ok: false, message: "Please select a course." };

    const alreadyAssigned = db.learnerCourses.some(
      (record) => record.userId === payload.userId && record.courseId === payload.courseId
    );
    if (alreadyAssigned) return { ok: false, message: "This course is already assigned to this learner." };

    updateDB((draft) => {
      draft.learnerCourses.push({
        id: uid(),
        ...payload,
        registeredAt: new Date().toISOString()
      });
    });

    return { ok: true, message: "Course assigned to learner." };
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

  function addSessionSlot(slot: Omit<SessionSlot, "id">): void {
    updateDB((draft) => {
      draft.sessionSlots.push({ id: uid(), ...slot });
    });
  }

  function updateSessionSlotStatus(slotId: string, status: SessionSlotStatus): void {
    updateDB((draft) => {
      const slot = draft.sessionSlots.find((item) => item.id === slotId);
      if (slot) slot.status = status;
    });
  }

  function reserveSessionSlot(slotId: string, learnerName: string, notes = ""): void {
    updateDB((draft) => {
      const slot = draft.sessionSlots.find((item) => item.id === slotId);
      if (slot) {
        slot.status = "reserved";
        slot.learnerName = learnerName;
        if (notes.trim()) slot.notes = notes.trim();
      }
    });
  }

  function deleteSessionSlot(slotId: string): void {
    updateDB((draft) => {
      draft.sessionSlots = draft.sessionSlots.filter((slot) => slot.id !== slotId);
    });
  }

  function updateSessionSettings(settings: SessionSettings): void {
    updateDB((draft) => {
      draft.sessionSettings = {
        defaultDailySlots: Math.max(1, Math.round(settings.defaultDailySlots)),
        slotDurationMinutes: Math.max(15, Math.round(settings.slotDurationMinutes))
      };
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
    if (!normalizedEmail) return { ok: false, message: "Please enter the learner email." };

    try {
      const response = await apiClient.post<{ message?: string }>("/users/forgot-password", { email: normalizedEmail });
      return { ok: true, message: response.data.message ?? "Password reset email requested." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Failed to request password reset." };
    }
  }

  function addReview(name: string, rating: number, text: string): void {
    updateDB((draft) => {
      draft.reviews.push({ id: uid(), name, rating, text });
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
    submitContact,
    submitQuestionnaire,
    submitTest,
    updateRequestStatus,
    addCourse,
    updateCourse,
    deleteCourse,
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
