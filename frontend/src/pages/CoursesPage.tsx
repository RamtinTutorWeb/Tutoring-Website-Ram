import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useContent } from "../api/ContentProvider";
import { useLearnerCourses } from "../api/hooks";
import { useMe } from "../api/MeProvider";
import { useSession } from "../auth/session";
import AdminEditLink from "../components/AdminEditLink";
import LoadState from "../components/LoadState";
import Prose from "../components/Prose";

export default function CoursesPage() {
  const { content, loading, error, refetch } = useContent();
  const { isSignedIn } = useSession();
  const { isAdmin } = useMe();
  const learnerCourses = useLearnerCourses();
  const allCourses = useMemo(() => [...content.courses, ...content.examPrepTracks], [content.courses, content.examPrepTracks]);
  // Only show categories that have courses in them.
  const categories = useMemo(
    () => content.selectableOptions.courseCategories.filter((category) => allCourses.some((course) => course.category === category)),
    [content.selectableOptions.courseCategories, allCourses]
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const activeCategory = categories.includes(categoryFilter) ? categoryFilter : "";
  const visible = activeCategory ? allCourses.filter((course) => course.category === activeCategory) : allCourses;

  return (
    <section data-page="courses" className="page">
      <div className="page-head">
        <h2>Courses</h2>
        <p className="lead">Pick a course to see the topics it covers.</p>
      </div>
      <LoadState loading={loading} error={error} onRetry={() => void refetch()} />

      {categories.length > 1 ? (
        <div className="chip-row" role="group" aria-label="Filter by category">
          <button type="button" className={`chip ${activeCategory ? "" : "active"}`} onClick={() => setCategoryFilter("")}>All</button>
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              className={`chip ${activeCategory === category ? "active" : ""}`}
              onClick={() => setCategoryFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      <div className="card-grid" id="course-details">
        {visible.map((course) => (
          <div className="card course-card" key={course.id}>
            <span className="tag">{course.category}</span>
            <h3 style={{ marginTop: "0.6rem" }}>{course.title}</h3>
            <Prose text={course.description} />
            {!isAdmin ? (
              isSignedIn ? <RegisterButton courseId={course.id} learnerCourses={learnerCourses} /> : null
            ) : null}
          </div>
        ))}
      </div>
      {!visible.length && !loading ? <p className="muted">No courses yet.</p> : null}
      {!isSignedIn && visible.length ? (
        <p className="muted"><Link to="/sign-in">Sign in</Link> to register for a course and track your progress.</p>
      ) : null}

      <AdminEditLink tab="courses" />
    </section>
  );
}

function RegisterButton({ courseId, learnerCourses }: { courseId: string; learnerCourses: ReturnType<typeof useLearnerCourses> }) {
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);
  const alreadyRegistered = (learnerCourses.data ?? []).some((record) => record.courseId === courseId);

  async function register() {
    setBusy(true);
    try {
      await learnerCourses.register(courseId);
      setFeedback({ text: "Registered. Track progress in your dashboard.", error: false });
    } catch (err) {
      setFeedback({ text: errorMessage(err, "Could not register for this course."), error: true });
    } finally {
      setBusy(false);
    }
  }

  if (learnerCourses.loading) return null;
  if (alreadyRegistered && !feedback.text) {
    return <p className="muted">Registered · <Link to="/dashboard">View progress</Link></p>;
  }

  return (
    <>
      {!alreadyRegistered ? (
        <button className="small" type="button" disabled={busy} onClick={() => void register()}>Register</button>
      ) : null}
      {feedback.text ? <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p> : null}
    </>
  );
}
