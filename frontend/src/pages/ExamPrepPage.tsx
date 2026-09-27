import { useContent } from "../api/ContentProvider";
import { useMe } from "../api/MeProvider";
import LoadState from "../components/LoadState";
import { ExamTrackEditor, OptionsEditor } from "./settings/editors";

export default function ExamPrepPage() {
  const { content, loading, error, refetch } = useContent();
  const { isAdmin } = useMe();
  const tracks = content.examPrepTracks;
  const options = content.selectableOptions;

  return (
    <section data-page="exam-prep" className="page">
      <h2>Exam Prep</h2>
      <p className="muted">
        Dedicated tracks for exam strategy, topic targeting, timed practice, and mock sessions.
      </p>
      <LoadState loading={loading} error={error} onRetry={() => void refetch()} />

      <div className="course-progress-list">
        {tracks.length ? tracks.map((course) => (
          <div className="card" key={course.id}>
            <h3>{course.title}</h3>
            <p>{course.description}</p>
          </div>
        )) : !loading ? (
          <div className="card">
            <p className="muted">No exam prep tracks are configured yet.</p>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>Exam Parameters</h3>
        <ul className="exam-list">
          <li><strong>Service types:</strong> {options.serviceTypes.join(", ")}</li>
          <li><strong>Urgency windows:</strong> {options.urgencyWindows.join(", ")}</li>
          <li><strong>Assessment subjects:</strong> {options.assessmentSubjects.join(", ")}</li>
        </ul>
      </div>

      {isAdmin ? (
        <div className="dashboard-stack" id="exam-prep-admin">
          <ExamTrackEditor />
          <OptionsEditor title="Exam Parameter Values" groups={["urgencyWindows", "serviceTypes", "assessmentSubjects"]} />
        </div>
      ) : null}
    </section>
  );
}
