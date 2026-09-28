import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { useContent } from "../../api/ContentProvider";
import { useAdminUsers, useBookings, useLearnerCourses, useRequests } from "../../api/hooks";
import type { CourseStatus, Profile } from "../../api/types";
import LoadState from "../../components/LoadState";
import StatCard from "../../components/StatCard";
import { formatDate, formatDateTime } from "../../lib/format";
import { courseLookup, courseStatusLabels } from "./labels";
import RequestsCard from "./RequestsCard";

export default function AdminDashboard() {
  const { content } = useContent();
  const requests = useRequests();
  const bookings = useBookings();
  const learnerCourses = useLearnerCourses();
  const users = useAdminUsers(true);
  const [progressFeedback, setProgressFeedback] = useState({ text: "", error: false });

  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState("");

  const catalog = [...content.courses, ...content.examPrepTracks];
  const findCourse = courseLookup(catalog);
  const allUsers = users.data ?? [];
  const usersById = new Map<string, Profile>(allUsers.map((user) => [user.id, user]));
  const students = allUsers.filter((user) => user.role === "student");
  const openRequests = (requests.data ?? []).filter((request) => request.status === "new" || request.status === "accepted");
  const now = Date.now();
  const upcoming = [...(bookings.data ?? [])]
    .filter((booking) => booking.status === "scheduled" && Date.parse(booking.startAt ?? "") >= now)
    .sort((a, b) => Date.parse(a.startAt ?? "") - Date.parse(b.startAt ?? ""));
  const pastOrCanceled = (bookings.data ?? []).filter((booking) => !upcoming.includes(booking));

  async function changeCourseStatus(id: string, status: CourseStatus) {
    try {
      await learnerCourses.updateStatus(id, status);
      setProgressFeedback({ text: "Course status updated.", error: false });
    } catch (err) {
      setProgressFeedback({ text: errorMessage(err, "Could not update course status."), error: true });
    }
  }

  async function handleAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const studentId = String(fd.get("studentId") ?? "");
    const courseId = String(fd.get("courseId") ?? "");
    if (!studentId || !courseId) return;
    setAssigning(true);
    try {
      await learnerCourses.register(courseId, studentId);
      setProgressFeedback({ text: "Course assigned to student.", error: false });
      form.reset();
    } catch (err) {
      setProgressFeedback({ text: errorMessage(err, "Could not assign this course."), error: true });
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm("Remove this course registration?")) return;
    setRemovingId(id);
    try {
      await learnerCourses.remove(id);
      setProgressFeedback({ text: "Registration removed.", error: false });
    } catch (err) {
      setProgressFeedback({ text: errorMessage(err, "Could not remove this registration."), error: true });
    } finally {
      setRemovingId("");
    }
  }

  return (
    <div className="dashboard-stack" id="admin-dashboard">
      <div className="dashboard-grid">
        <StatCard label="Students" value={students.length} />
        <StatCard label="Courses" value={content.courses.length + content.examPrepTracks.length} />
        <StatCard label="Open Requests" value={openRequests.length} />
        <StatCard label="Upcoming Sessions" value={upcoming.length} />
      </div>

      <RequestsCard
        requests={requests.data ?? []}
        loading={requests.loading}
        error={requests.error}
        onRetry={() => void requests.refetch()}
        updateStatus={requests.updateStatus}
        defaultFilter="new"
      />

      <details className="card courses-overview admin-management" open>
        <summary>Booked Sessions</summary>
        <div className="admin-management-content">
          <p className="muted">Bookings sync from Calendly. Manage availability and event types in Calendly.</p>
          <LoadState loading={bookings.loading} error={bookings.error} onRetry={() => void bookings.refetch()} />
          <div className="list">
            {[...upcoming, ...pastOrCanceled].map((booking) => (
              <div className="list-item" key={booking.id}>
                <p>
                  <strong>{booking.inviteeName || booking.inviteeEmail || "Unknown invitee"}</strong>
                  {" | "}{booking.eventTypeName || "Session"}{" | "}{formatDateTime(booking.startAt)}
                </p>
                <p className="muted">
                  {booking.inviteeEmail ?? ""}
                  {booking.status === "canceled" ? ` | Canceled${booking.cancelReason ? `: ${booking.cancelReason}` : ""}` : " | Scheduled"}
                </p>
              </div>
            ))}
            {!bookings.loading && !bookings.error && !(bookings.data ?? []).length ? <p className="muted">No bookings yet.</p> : null}
          </div>
        </div>
      </details>

      <details className="card courses-overview admin-management">
        <summary>Student Courses</summary>
        <div className="admin-management-content">
          <form onSubmit={handleAssign}>
            <label>Student
              <select name="studentId" required defaultValue="">
                <option value="">{users.loading ? "Loading students..." : "Select student"}</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{student.fullName || student.email} - {student.email}</option>
                ))}
              </select>
            </label>
            <label>Course
              <select name="courseId" required defaultValue="">
                <option value="">Select course</option>
                {catalog.map((course) => <option key={course.id} value={course.id}>{course.title} ({course.category})</option>)}
              </select>
            </label>
            <button className="primary" type="submit" disabled={assigning}>Assign Course</button>
          </form>
          <LoadState loading={learnerCourses.loading} error={learnerCourses.error} onRetry={() => void learnerCourses.refetch()} />
          <div className="list">
            {(learnerCourses.data ?? []).map((record) => {
              const learner = usersById.get(record.studentId);
              const course = findCourse(record.courseId);
              return (
                <div className="list-item learner-course-row" key={record.id}>
                  <div>
                    <strong>{learner?.fullName || learner?.email || "Unknown student"}</strong>
                    <p className="muted">{course?.title ?? "Unknown course"} | {learner?.email ?? "No email"} | Registered {formatDate(record.registeredAt)}</p>
                  </div>
                  <div className="row">
                    <select
                      aria-label="Course status"
                      value={record.status}
                      onChange={(e) => void changeCourseStatus(record.id, e.target.value as CourseStatus)}
                    >
                      {Object.entries(courseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button className="danger" type="button" disabled={removingId === record.id} onClick={() => void handleRemove(record.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            {!learnerCourses.loading && !(learnerCourses.data ?? []).length ? <p className="muted">No student course registrations yet.</p> : null}
          </div>
          <p className={`feedback ${progressFeedback.error ? "error" : ""}`} role="status">{progressFeedback.text}</p>
        </div>
      </details>

      <details className="card courses-overview admin-management">
        <summary>Users</summary>
        <div className="admin-management-content">
          <p className="muted">Accounts are managed in Clerk. Set <code>publicMetadata.role = "admin"</code> there to grant admin access.</p>
          <LoadState loading={users.loading} error={users.error} onRetry={() => void users.refetch()} />
          <div className="list">
            {allUsers.map((user) => (
              <div className="list-item" key={user.id}>
                <p><strong>{user.fullName || user.email}</strong> {user.role === "admin" ? <span className="role-pill">Admin</span> : null}</p>
                <p className="muted">{user.email}{user.phone ? ` | ${user.phone}` : ""} | Joined {formatDate(user.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </details>

      <div className="card">
        <h3>Site Content</h3>
        <p className="muted">Edit courses, exam tracks, reviews, FAQ, and form options.</p>
        <Link className="button-link primary" to="/settings">Open Settings</Link>
      </div>
    </div>
  );
}
