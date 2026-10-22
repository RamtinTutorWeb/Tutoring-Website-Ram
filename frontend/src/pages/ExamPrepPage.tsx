import { Link } from "react-router-dom";
import { useContent } from "../api/ContentProvider";
import { useMe } from "../api/MeProvider";
import LoadState from "../components/LoadState";
import { ExamTrackEditor, OptionsEditor } from "./settings/editors";

const approach = [
  { title: "Diagnose", text: "A placement check and past-paper review pinpoint the topics costing you marks." },
  { title: "Target", text: "Sessions focus on those topics with exam-style questions, not generic revision." },
  { title: "Rehearse", text: "Timed practice and full mock papers build speed and calm for the real thing." }
];

export default function ExamPrepPage() {
  const { content, loading, error, refetch } = useContent();
  const { isAdmin } = useMe();
  const tracks = content.examPrepTracks;
  const options = content.selectableOptions;

  return (
    <section data-page="exam-prep" className="page">
      <div className="page-heading">
        <p className="eyebrow">Exam prep</p>
        <h2>Walk into the exam ready</h2>
        <p className="lead">Dedicated tracks for exam strategy, topic targeting, timed practice and mock sessions.</p>
      </div>
      <LoadState loading={loading} error={error} onRetry={() => void refetch()} />

      <ol className="steps steps-3">
        {approach.map((step, index) => (
          <li className="step" key={step.title}>
            <span className="step-num">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="section-head"><h2>Tracks</h2></div>
      {tracks.length ? (
        <div className="course-grid">
          {tracks.map((course) => (
            <article className="course-card" key={course.id}>
              <span className="tag tag-accent">Exam Prep</span>
              <h3>{course.title}</h3>
              <p>{course.description}</p>
              {!isAdmin ? <div className="course-card-foot"><Link className="text-link" to="/contact">Start this track →</Link></div> : null}
            </article>
          ))}
        </div>
      ) : !loading ? (
        <div className="empty-state">No exam prep tracks yet. <Link to="/contact">Tell us your exam</Link> and we'll plan one.</div>
      ) : null}

      <div className="card exam-facts">
        <div><h4>Levels</h4><p>{options.serviceTypes.join(" · ") || "-"}</p></div>
        <div><h4>Exam windows</h4><p>{options.urgencyWindows.join(" · ") || "-"}</p></div>
        <div><h4>Subjects</h4><p>{options.assessmentSubjects.join(" · ") || "-"}</p></div>
      </div>

      {!isAdmin ? (
        <div className="cta-band">
          <div>
            <h3>Exam coming up?</h3>
            <p>Take the free assessment, then send a request with your exam date.</p>
          </div>
          <div className="row">
            <Link className="button-link primary" to="/assessment">Take the assessment</Link>
            <Link className="button-link ghost" to="/contact">Send a request</Link>
          </div>
        </div>
      ) : (
        <div className="dashboard-stack" id="exam-prep-admin">
          <ExamTrackEditor />
          <OptionsEditor title="Exam Parameter Values" groups={["urgencyWindows", "serviceTypes", "assessmentSubjects"]} />
        </div>
      )}
    </section>
  );
}
