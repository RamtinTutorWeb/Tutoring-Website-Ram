import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { useContent } from "../../api/ContentProvider";
import { useAdminUsers, useAssessments, useBookings, useLearnerCourses, useRequests, useResources } from "../../api/hooks";
import type { CourseStatus, Profile } from "../../api/types";
import LoadState from "../../components/LoadState";
import StatCard from "../../components/StatCard";
import { formatDate, formatDateTime, formatSessionTime } from "../../lib/format";
import RequestsCard from "../dashboard/RequestsCard";
import { courseLookup, courseStatusLabels } from "../dashboard/labels";

function displayName(profile: Profile): string {
  return profile.fullName || profile.email;
}

/** Admin: one student's full record, with course assignment and resource sharing. */
export function StudentDetailPage() {
  const { id = "" } = useParams();
  const { content } = useContent();
  const users = useAdminUsers(true);
  const requests = useRequests();
  const bookings = useBookings();
  const learnerCourses = useLearnerCourses();
  const assessments = useAssessments();
  const resources = useResources();
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);

  const student = (users.data ?? []).find((user) => user.id === id) ?? null;
  const catalog = [...content.courses, ...content.examPrepTracks];
  const findCourse = courseLookup(catalog);
  const myRequests = (requests.data ?? []).filter((r) => r.studentId === id || (student && r.email === student.email));
  const myBookings = [...(bookings.data ?? [])]
    .filter((b) => b.studentId === id)
    .sort((a, b) => Date.parse(b.startAt ?? "") - Date.parse(a.startAt ?? ""));
  const now = Date.now();
  const upcoming = myBookings.filter((b) => b.status === "scheduled" && Date.parse(b.startAt ?? "") >= now);
  const myCourses = (learnerCourses.data ?? []).filter((c) => c.studentId === id);
  const myAssessments = (assessments.data ?? []).filter((a) => a.studentId === id);
  const shared = (resources.data ?? []).filter((r) => r.visibility === "private" && r.studentIds.includes(id));
  const shareable = (resources.data ?? []).filter((r) => r.visibility === "private" && !r.studentIds.includes(id));
  const assignable = catalog.filter((course) => !myCourses.some((c) => c.courseId === course.id));

  async function act(action: () => Promise<unknown>, success: string, form?: HTMLFormElement) {
    setBusy(true);
    try {
      await action();
      setFeedback({ text: success, error: false });
      form?.reset();
    } catch (err) {
      setFeedback({ text: errorMessage(err, "Something went wrong."), error: true });
    } finally {
      setBusy(false);
    }
  }

  function handleAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const courseId = String(new FormData(e.currentTarget).get("courseId") ?? "");
    if (courseId) void act(() => learnerCourses.register(courseId, id), "Course assigned.", e.currentTarget);
  }

  function handleShare(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const resourceId = String(new FormData(e.currentTarget).get("resourceId") ?? "");
    const resource = shareable.find((r) => r.id === resourceId);
    if (resource) {
      void act(
        () => resources.update(resource.id, { studentIds: [...resource.studentIds, id] }),
        `Shared "${resource.title}". ${student ? displayName(student) : "The student"} will get an email.`,
        e.currentTarget
      );
    }
  }

  function unshare(resourceId: string) {
    const resource = shared.find((r) => r.id === resourceId);
    if (!resource) return;
    const rest = resource.studentIds.filter((x) => x !== id);
    if (!rest.length && !window.confirm(`"${resource.title}" won't be shared with anyone after this. Continue?`)) return;
    void act(() => resources.update(resource.id, { studentIds: rest }), "Access removed.");
  }

  if (users.loading && !users.data) return <section className="page"><p className="muted">Loading...</p></section>;
  if (!student) {
    return (
      <section className="page">
        <LoadState loading={false} error={users.error} onRetry={() => void users.refetch()} />
        <div className="empty-state">Student not found. <Link to="/admin/students">Back to students</Link></div>
      </section>
    );
  }

  return (
    <section data-page="student-detail" className="page dashboard-page">
      <Link className="text-link" to="/admin/students">← All students</Link>
      <div className="dashboard-hero">
        <div className="dashboard-hero-main">
          <p className="hero-kicker">Student</p>
          <h2>{displayName(student)}</h2>
          <p>{student.email}{student.phone ? ` · ${student.phone}` : ""} · Joined {formatDate(student.createdAt)}</p>
        </div>
        <div className="row">
          <a className="button-link primary" href={`mailto:${student.email}`}>Email</a>
          {student.phone ? <a className="button-link" href={`tel:${student.phone.replace(/[^\d+]/g, "")}`}>Call</a> : null}
        </div>
      </div>

      <div className="dashboard-grid">
        <StatCard label="Requests" value={myRequests.length} />
        <StatCard label="Upcoming Sessions" value={upcoming.length} />
        <StatCard label="Courses" value={myCourses.length} />
        <StatCard label="Assessments" value={myAssessments.length} />
      </div>
      <p className={`feedback ${feedback.error ? "error" : "ok"}`} role="status">{feedback.text}</p>

      <RequestsCard
        requests={myRequests}
        loading={requests.loading}
        error={requests.error}
        onRetry={() => void requests.refetch()}
        updateStatus={requests.updateStatus}
        collapsible={false}
      />

      <div className="grid-2 align-start">
        <div className="card">
          <h3>Sessions</h3>
          <LoadState loading={bookings.loading} error={bookings.error} onRetry={() => void bookings.refetch()} />
          <div className="list">
            {myBookings.map((b) => (
              <div className={`list-item session-row ${b.status === "canceled" ? "is-canceled" : ""}`} key={b.id}>
                <div>
                  <p><strong>{b.eventTypeName || "Session"}</strong> · {formatSessionTime(b.startAt)}</p>
                  <p className="muted">{b.status === "canceled" ? `Canceled${b.cancelReason ? `: ${b.cancelReason}` : ""}` : Date.parse(b.startAt ?? "") >= now ? "Upcoming" : "Completed"}</p>
                </div>
              </div>
            ))}
            {!bookings.loading && !myBookings.length ? <p className="muted">No sessions booked yet.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Assessments</h3>
          <LoadState loading={assessments.loading} error={assessments.error} onRetry={() => void assessments.refetch()} />
          <div className="list">
            {myAssessments.map((a) => (
              <div className="list-item" key={a.id}>
                <p><strong>{a.subject || "General"}</strong> · {a.score ?? "-"}/{a.total ?? "-"}</p>
                {a.recommendation ? <p>Focus: {a.recommendation}</p> : null}
                <p className="muted">{formatDateTime(a.createdAt)}</p>
              </div>
            ))}
            {!assessments.loading && !myAssessments.length ? <p className="muted">No saved assessments.</p> : null}
          </div>
        </div>
      </div>

      <div className="grid-2 align-start">
        <div className="card">
          <h3>Courses</h3>
          <LoadState loading={learnerCourses.loading} error={learnerCourses.error} onRetry={() => void learnerCourses.refetch()} />
          <div className="list">
            {myCourses.map((record) => {
              const course = findCourse(record.courseId);
              return (
                <div className="list-item learner-course-row" key={record.id}>
                  <div>
                    <strong>{course?.title ?? "Course removed"}</strong>
                    <p className="muted">Registered {formatDate(record.registeredAt)}</p>
                  </div>
                  <div className="row">
                    <select
                      aria-label={`Status for ${course?.title ?? "course"}`}
                      value={record.status}
                      disabled={busy}
                      onChange={(e) => void act(() => learnerCourses.updateStatus(record.id, e.target.value as CourseStatus), "Course status updated.")}
                    >
                      {Object.entries(courseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button
                      className="danger"
                      type="button"
                      disabled={busy}
                      onClick={() => { if (window.confirm("Remove this course registration?")) void act(() => learnerCourses.remove(record.id), "Registration removed."); }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            {!learnerCourses.loading && !myCourses.length ? <p className="muted">No courses yet.</p> : null}
          </div>
          {assignable.length ? (
            <form className="inline-form" onSubmit={handleAssign}>
              <label>Assign a course
                <select name="courseId" required defaultValue="">
                  <option value="">Select course</option>
                  {assignable.map((course) => <option key={course.id} value={course.id}>{course.title} ({course.category})</option>)}
                </select>
              </label>
              <button className="primary" type="submit" disabled={busy}>Assign</button>
            </form>
          ) : null}
        </div>

        <div className="card">
          <h3>Shared with {displayName(student)}</h3>
          <p className="muted">Private resources only; public and all-student material is visible to everyone already.</p>
          <LoadState loading={resources.loading} error={resources.error} onRetry={() => void resources.refetch()} />
          <div className="list">
            {shared.map((r) => (
              <div className="list-item session-row" key={r.id}>
                <div>
                  <p><strong>{r.title}</strong></p>
                  <p className="muted">{r.kind === "file" ? r.fileName : r.url}</p>
                </div>
                <div className="row"><button type="button" disabled={busy} onClick={() => unshare(r.id)}>Remove access</button></div>
              </div>
            ))}
            {!resources.loading && !shared.length ? <p className="muted">Nothing shared privately yet.</p> : null}
          </div>
          {shareable.length ? (
            <form className="inline-form" onSubmit={handleShare}>
              <label>Share a private resource
                <select name="resourceId" required defaultValue="">
                  <option value="">Select resource</option>
                  {shareable.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </label>
              <button className="primary" type="submit" disabled={busy}>Share</button>
            </form>
          ) : null}
          <Link className="text-link" to="/admin/resources">Upload new material →</Link>
        </div>
      </div>
    </section>
  );
}
