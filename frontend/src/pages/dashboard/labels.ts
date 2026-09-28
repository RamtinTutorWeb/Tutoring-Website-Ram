import type { Course, CourseStatus, RequestStatus } from "../../api/types";

export const courseStatusLabels: Record<CourseStatus, string> = {
  registered: "Registered",
  "in-progress": "In Progress",
  passed: "Passed"
};

export const requestStatusLabels: Record<RequestStatus, string> = {
  new: "New",
  accepted: "Accepted",
  declined: "Declined",
  scheduled: "Scheduled",
  closed: "Closed"
};

export function courseLookup(courses: Course[]): (courseId: string) => Course | undefined {
  const byId = new Map(courses.map((course) => [course.id, course]));
  return (courseId) => byId.get(courseId);
}
