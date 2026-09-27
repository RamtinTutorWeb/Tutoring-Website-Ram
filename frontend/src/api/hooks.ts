import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../auth/session";
import { createApiClient, errorMessage, type ApiClient } from "./client";
import type {
  Assessment,
  Booking,
  CourseStatus,
  LearnerCourse,
  NewAssessment,
  NewRequest,
  NewReview,
  Profile,
  RequestStatus,
  Review,
  SessionRequest
} from "./types";

/** API client bound to the current Clerk session (sends the bearer token when signed in). */
export function useApi(): ApiClient {
  const { getToken } = useSession();
  return useMemo(() => createApiClient(getToken), [getToken]);
}

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  setData: (update: (current: T | null) => T | null) => void;
}

/** GET `path` on mount / when it changes. Pass `null` to skip (e.g. signed out). */
export function useResource<T>(path: string | null): Resource<T> {
  const api = useApi();
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState("");
  const requestSeq = useRef(0);

  const refetch = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (path === null) {
      setDataState(null);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.get<T>(path);
      if (seq === requestSeq.current) setDataState(result);
    } catch (err) {
      if (seq === requestSeq.current) setError(errorMessage(err, "Could not load data."));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [api, path]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const setData = useCallback((update: (current: T | null) => T | null) => setDataState(update), []);

  return { data, loading, error, refetch, setData };
}

function replaceById<T extends { id: string }>(items: T[] | null, next: T): T[] {
  return (items ?? []).map((item) => (item.id === next.id ? next : item));
}

/** Students get their own requests, admins get all (newest first). */
export function useRequests() {
  const { isSignedIn } = useSession();
  const api = useApi();
  const resource = useResource<SessionRequest[]>(isSignedIn ? "/requests" : null);
  const { setData } = resource;

  const updateStatus = useCallback(async (id: string, status: RequestStatus) => {
    const updated = await api.patch<SessionRequest>(`/requests/${encodeURIComponent(id)}`, { status });
    setData((current) => replaceById(current, updated));
    return updated;
  }, [api, setData]);

  return { ...resource, updateStatus };
}

/** Public: works signed out; the backend links the request to the student when a token is sent. */
export function useCreateRequest() {
  const api = useApi();
  return useCallback((request: NewRequest) => api.post<SessionRequest>("/requests", request), [api]);
}

export function useBookings() {
  const { isSignedIn } = useSession();
  return useResource<Booking[]>(isSignedIn ? "/bookings" : null);
}

export function useLearnerCourses() {
  const { isSignedIn } = useSession();
  const api = useApi();
  const resource = useResource<LearnerCourse[]>(isSignedIn ? "/learner-courses" : null);
  const { setData } = resource;

  /** Students always register themselves; `studentId` is honored only for admins (assign). */
  const register = useCallback(async (courseId: string, studentId?: string) => {
    const created = await api.post<LearnerCourse>("/learner-courses", studentId ? { courseId, studentId } : { courseId });
    setData((current) => [...(current ?? []), created]);
    return created;
  }, [api, setData]);

  const updateStatus = useCallback(async (id: string, status: CourseStatus) => {
    const updated = await api.patch<LearnerCourse>(`/learner-courses/${encodeURIComponent(id)}`, { status });
    setData((current) => replaceById(current, updated));
    return updated;
  }, [api, setData]);

  const remove = useCallback(async (id: string) => {
    await api.delete(`/learner-courses/${encodeURIComponent(id)}`);
    setData((current) => (current ?? []).filter((record) => record.id !== id));
  }, [api, setData]);

  return { ...resource, register, updateStatus, remove };
}

export function useAssessments() {
  const { isSignedIn } = useSession();
  return useResource<Assessment[]>(isSignedIn ? "/assessments" : null);
}

export function useCreateAssessment() {
  const api = useApi();
  return useCallback((assessment: NewAssessment) => api.post<Assessment>("/assessments", assessment), [api]);
}

/** Creates a pending review; it shows on the site after an admin approves it in Settings. */
export function useCreateReview() {
  const api = useApi();
  return useCallback((review: NewReview) => api.post<Review>("/reviews", review), [api]);
}

export function useAdminUsers(enabled: boolean) {
  return useResource<Profile[]>(enabled ? "/admin/users" : null);
}
