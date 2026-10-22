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
  // One fetch for the whole grid (signed-out viewers skip it inside the hook).
  const learnerCourses = useLearnerCourses();
  const allCourses = useMemo(() => [...content.courses, ...content.examPrepTracks], [content.courses, content.examPrepTracks]);
  // Configured categories first, then any category a course uses that isn't configured.
  const categories = useMemo(() => {
    const configured = content.selectableOptions.courseCategories.filter((category) => category !== "All");
    const used = allCourses.map((course) => course.category).filter((category) => !configured.includes(category));
    return [...configured, ...new Set(used)].filter((category) => allCourses.some((course) => course.category === category));
  }, [content.selectableOptions.courseCategories, allCourses]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visible = allCourses.filter((course) => (
    (!category || course.category === category) &&
    (!term || `${course.title} ${course.description}`.toLowerCase().includes(term))
  ));

  return (
    <section data-page="courses" className="page">
      <div className="page-heading">
        <p className="eyebrow">Courses</p>
        <h2>What we can work on</h2>
        <p className="lead">
          {isAdmin ? "Your public catalog. Edit it below." : "Pick a course to see the topics it covers. Signed-in students can register to track progress."}
        </p>
      </div>
      <LoadState loading={loading} error={error} onRetry={() => void refetch()} />

      <div className="chip-filters" role="group" aria-label="Filter by category">
        <button type="button" className={!category ? "chip active" : "chip"} aria-pressed={!category} onClick={() => setCategory("")}>All</button>
        {categories.map((cat) => (
          <button type="button" key={cat} className={category === cat ? "chip active" : "chip"} aria-pressed={category === cat} onClick={() => setCategory(cat)}>{cat}</button>
        ))}
        <input className="chip-search" type="search" aria-label="Search courses" placeholder="Search topics" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {visible.length ? (
        <div className="course-grid">
          {visible.map((course) => (
            <article className="course-card" key={course.id}>
              <span className="tag">{course.category}</span>
              <h3>{course.title}</h3>
              <p>{course.description}</p>
              <div className="course-card-foot">
                {isAdmin ? null : isSignedIn ? <RegisterButton courseId={course.id} learnerCourses={learnerCourses} /> : (
                  <Link className="text-link" to={`/sign-in?redirect_url=${encodeURIComponent("/courses")}`}>Sign in to register →</Link>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : !loading ? (
        <div className="empty-state">{allCourses.length ? "No courses match these filters." : "Courses are being added. Get in touch to discuss what you need."}</div>
      ) : null}

      {!isAdmin ? (
        <div className="cta-band">
          <div>
            <h3>Don't see your course?</h3>
            <p>Most university and high-school math and physics courses are covered. Ask about yours.</p>
          </div>
          <div className="row"><Link className="button-link primary" to="/contact">Ask about a course</Link></div>
        </div>
      ) : (
        <div className="dashboard-stack" id="courses-admin">
          <CourseCatalogEditor />
        </div>
      )}
    </section>
  );
}

function RegisterButton({
  courseId,
  learnerCourses
}: {
  courseId: string;
  learnerCourses: ReturnType<typeof useLearnerCourses>;
}) {
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

  if (learnerCourses.loading && !learnerCourses.data) return null;
  if (alreadyRegistered && !feedback.text) {
    return <p className="muted">✓ Registered · <Link to="/dashboard">View progress</Link></p>;
  }

  return (
    <>
      {!alreadyRegistered ? (
        <button className="primary" type="button" disabled={busy} onClick={() => void register()}>Register</button>
      ) : null}
      <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p>
    </>
  );
}
