import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { useContent } from "../../api/ContentProvider";
import { useAssessments, useBookings, useLearnerCourses, useRequests } from "../../api/hooks";
import type { CourseStatus } from "../../api/types";
import LoadState from "../../components/LoadState";
import ReviewForm from "../../components/ReviewForm";
import StatCard from "../../components/StatCard";
import { formatDate, formatDateTime } from "../../lib/format";
import { courseLookup, courseStatusLabels, requestStatusLabels } from "./labels";

export default function StudentDashboard() {
  const { content } = useContent();
  const requests = useRequests();
  const bookings = useBookings();
  const learnerCourses = useLearnerCourses();
  const assessments = useAssessments();
  const [courseFeedback, setCourseFeedback] = useState({ text: "", error: false });
  const [registering, setRegistering] = useState(false);
  const [droppingId, setDroppingId] = useState("");

  const catalog = [...content.courses, ...content.examPrepTracks];
  const findCourse = courseLookup(catalog);
  const myCourses = learnerCourses.data ?? [];
  const registeredIds = new Set(myCourses.map((record) => record.courseId));
  const availableCourses = catalog.filter((course) => !registeredIds.has(course.id));
  const statusCounts = myCourses.reduce<Record<CourseStatus, number>>(
    (acc, record) => ({ ...acc, [record.status]: acc[record.status] + 1 }),
    { registered: 0, "in-progress": 0, passed: 0 }
  );
  const myRequests = requests.data ?? [];
  const myBookings = [...(bookings.data ?? [])].sort((a, b) => Date.parse(a.startAt ?? "") - Date.parse(b.startAt ?? ""));
  const myAssessments = [...(assessments.data ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const courseId = String(new FormData(form).get("courseId") ?? "");
    if (!courseId) return;
    setRegistering(true);
    try {
      await learnerCourses.register(courseId);
      setCourseFeedback({ text: "Registered. Your tutor will update your progress.", error: false });
      form.reset();
    } catch (err) {
      setCourseFeedback({ text: errorMessage(err, "Could not register for this course."), error: true });
    } finally {
      setRegistering(false);
    }
  }

  async function handleDrop(id: string, title: string) {
    if (!window.confirm(`Drop ${title}?`)) return;
    setDroppingId(id);
    try {
      await learnerCourses.remove(id);
      setCourseFeedback({ text: `Dropped ${title}.`, error: false });
    } catch (err) {
      setCourseFeedback({ text: errorMessage(err, "Could not drop this course."), error: true });
    } finally {
      setDroppingId("");
    }
  }

  return (
    <div className="dashboard-stack" id="learner-dashboard">
      <div className="dashboard-grid">
        <StatCard label="Registered" value={statusCounts.registered} />
        <StatCard label="In Progress" value={statusCounts["in-progress"]} />
        <StatCard label="Passed" value={statusCounts.passed} />
        <StatCard label="Requests" value={myRequests.length} />
      </div>

      <div className="card" id="student-request-history">
        <div className="request-card-head">
          <h3>My Tutoring Requests</h3>
          <Link className="button-link" to="/contact">New Request</Link>
        </div>
        <LoadState loading={requests.loading} error={requests.error} onRetry={() => void requests.refetch()} />
        {myRequests.length ? myRequests.map((request) => (
          <details className="list-item request-detail" key={request.id}>
            <summary>
              <strong>{request.subject || request.serviceType || "General inquiry"}</strong>
              <span className={`request-status status-${request.status}`}>{requestStatusLabels[request.status]}</span>
            </summary>
            <div className="request-body">
              <p>{request.message || "No description provided."}</p>
              {request.earliestDate ? <p><strong>Earliest start:</strong> {request.earliestDate}</p> : null}
              {request.hardTopics ? <p><strong>Topics:</strong> {request.hardTopics}</p> : null}
              <p><strong>Submitted:</strong> {formatDateTime(request.createdAt)}</p>
              {request.status === "accepted" ? (
                <Link className="button-link primary" to={`/book?request=${encodeURIComponent(request.id)}`}>Book now</Link>
              ) : null}
            </div>
          </details>
        )) : !requests.loading && !requests.error ? (
          <p className="muted">No requests yet. <Link to="/contact">Send a tutoring request</Link> to get started.</p>
        ) : null}
      </div>

      <div className="card" id="student-bookings">
        <h3>My Sessions</h3>
        <LoadState loading={bookings.loading} error={bookings.error} onRetry={() => void bookings.refetch()} />
        <div className="list">
          {myBookings.length ? myBookings.map((booking) => (
            <div className="list-item" key={booking.id}>
              <p><strong>{booking.eventTypeName || "Tutoring session"}</strong> | {formatDateTime(booking.startAt)}</p>
              <p className="muted">
                {booking.status === "canceled" ? `Canceled${booking.cancelReason ? `: ${booking.cancelReason}` : ""}` : "Scheduled"}
              </p>
            </div>
          )) : !bookings.loading && !bookings.error ? (
            <p className="muted">No sessions booked yet. Once a request is accepted, use Book now to pick a time.</p>
          ) : null}
        </div>
      </div>

      <details className="card courses-overview" open>
        <summary>My Courses</summary>
        <LoadState loading={learnerCourses.loading} error={learnerCourses.error} onRetry={() => void learnerCourses.refetch()} />
        <div className="course-progress-list">
          {myCourses.length ? myCourses.map((record) => {
            const course = findCourse(record.courseId);
            return (
              <div className={`list-item status-${record.status}`} key={record.id}>
                <div className="course-progress-head">
                  <strong>{course?.title ?? "Course removed"}</strong>
                  <span>{courseStatusLabels[record.status]}</span>
                </div>
                <p className="muted">{course?.category ?? "No category"} | Registered {formatDate(record.registeredAt)}</p>
                <p>{course?.description ?? "This course is no longer available."}</p>
                <button
                  className="danger"
                  type="button"
                  disabled={droppingId === record.id}
                  onClick={() => void handleDrop(record.id, course?.title ?? "this course")}
                >
                  Drop Course
                </button>
              </div>
            );
          }) : !learnerCourses.loading && !learnerCourses.error ? <p className="muted">No courses registered yet.</p> : null}
        </div>
        {availableCourses.length ? (
          <form className="review-overview-content" onSubmit={handleRegister}>
            <label>Register for a course
              <select name="courseId" required defaultValue="">
                <option value="">Select course</option>
                {availableCourses.map((course) => <option key={course.id} value={course.id}>{course.title} ({course.category})</option>)}
              </select>
            </label>
            <button className="primary" type="submit" disabled={registering}>Register</button>
          </form>
        ) : null}
        <p className={`feedback ${courseFeedback.error ? "error" : ""}`} role="status">{courseFeedback.text}</p>
      </details>

      <div className="card" id="student-assessments">
        <div className="request-card-head">
          <h3>My Assessments</h3>
          <Link className="button-link" to="/assessment">Take Assessment</Link>
        </div>
        <LoadState loading={assessments.loading} error={assessments.error} onRetry={() => void assessments.refetch()} />
        <div className="list">
          {myAssessments.length ? myAssessments.map((assessment) => (
            <div className="list-item" key={assessment.id}>
              <p><strong>{assessment.subject || "General"}</strong> | Score {assessment.score ?? "-"}/{assessment.total ?? "-"}</p>
              {assessment.recommendation ? <p>Recommended focus: {assessment.recommendation}</p> : null}
              <p className="muted">{formatDateTime(assessment.createdAt)}</p>
            </div>
          )) : !assessments.loading && !assessments.error ? <p className="muted">No assessments saved yet.</p> : null}
        </div>
      </div>

      <ReviewForm />
    </div>
  );
}
