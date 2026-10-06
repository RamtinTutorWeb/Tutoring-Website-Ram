import { Link } from "react-router-dom";
import { useContent } from "../api/ContentProvider";
import AdminEditLink from "../components/AdminEditLink";
import LoadState from "../components/LoadState";
import Prose from "../components/Prose";

export default function ExamPrepPage() {
  const { content, loading, error, refetch } = useContent();
  const page = content.pages.examPrep;
  const tracks = content.examPrepTracks;
  const timelines = content.selectableOptions.urgencyWindows;

  return (
    <section data-page="exam-prep" className="page">
      <div className="page-head">
        <h2>Exam prep</h2>
        <Prose text={page.intro} className="lead" />
      </div>
      <LoadState loading={loading} error={error} onRetry={() => void refetch()} />

      <div className="card-grid">
        {tracks.map((track) => (
          <div className="card course-card" key={track.id}>
            <h3>{track.title}</h3>
            <Prose text={track.description} />
          </div>
        ))}
      </div>
      {!tracks.length && !loading ? <p className="muted">No exam prep tracks yet.</p> : null}

      {timelines.length ? (
        <div className="card">
          <h3>{page.timelinesTitle}</h3>
          <Prose text={page.timelinesText} className="muted" />
          <ul className="timeline-list">
            {timelines.map((window) => <li key={window}>{window}</li>)}
          </ul>
          <Link className="button-link primary" to="/contact">Tell me about your exam</Link>
        </div>
      ) : null}

      <AdminEditLink tab="exam-prep" />
    </section>
  );
}
