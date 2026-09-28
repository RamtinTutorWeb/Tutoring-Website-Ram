import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useContent } from "../api/ContentProvider";
import { useLearnerCourses } from "../api/hooks";
import { useMe } from "../api/MeProvider";
import { useSession } from "../auth/session";
import LoadState from "../components/LoadState";
import { CourseCatalogEditor } from "./settings/editors";

export default function CoursesPage() {
  const { content, loading, error, refetch } = useContent();
  const { isSignedIn } = useSession();
  const { isAdmin } = useMe();
  const categories = useMemo(
    () => content.selectableOptions.courseCategories.filter((category) => category !== "All"),
    [content.selectableOptions.courseCategories]
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const activeCategory = categoryFilter || categories[0] || "";
  const allCourses = useMemo(() => [...content.courses, ...content.examPrepTracks], [content.courses, content.examPrepTracks]);
  const filteredCourses = allCourses.filter((course) => course.category === activeCategory);
  const selectedCourse = filteredCourses.find((course) => course.id === selectedCourseId) ?? null;

  return (
    <section data-page="courses" className="page">
      <h2>Courses</h2>
      <p className="muted">
        {isAdmin ? "Browse courses and manage the catalog." : "Filter by category and select a course to view topics covered."}
      </p>
      <LoadState loading={loading} error={error} onRetry={() => void refetch()} />

      <div className="filters">
        <label>
          Category
          <select value={activeCategory} onChange={(e) => {
            setCategoryFilter(e.target.value);
            setSelectedCourseId("");
          }}>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </label>
        <label>
          Course
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} disabled={!activeCategory}>
            <option value="">{activeCategory ? "Select course" : "Select category first"}</option>
            {filteredCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </label>
      </div>

      <div className="card" id="course-details">
        {selectedCourse ? (
          <>
            <h3>{selectedCourse.title}</h3>
            <p><strong>Category:</strong> {selectedCourse.category}</p>
            <p>{selectedCourse.description}</p>
            {!isAdmin ? (
              isSignedIn ? <RegisterButton courseId={selectedCourse.id} /> : (
                <p className="muted"><Link to="/sign-in">Sign in</Link> to register for this course.</p>
              )
            ) : null}
          </>
        ) : filteredCourses.length ? (
          <p className="muted">Select a course to display details.</p>
        ) : !loading ? (
          <p className="muted">No courses found for this category.</p>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="dashboard-stack" id="courses-admin">
          <CourseCatalogEditor />
        </div>
      ) : null}
    </section>
  );
}

function RegisterButton({ courseId }: { courseId: string }) {
  const learnerCourses = useLearnerCourses();
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
    return <p className="muted">You are registered for this course. <Link to="/dashboard">View progress</Link></p>;
  }

  return (
    <>
      {!alreadyRegistered ? (
        <button className="primary" type="button" disabled={busy} onClick={() => void register()}>Register For This Course</button>
      ) : null}
      <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p>
    </>
  );
}
