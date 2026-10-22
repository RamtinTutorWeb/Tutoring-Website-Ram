import { Link } from "react-router-dom";
import { useContent } from "../api/ContentProvider";
import { useResources } from "../api/hooks";
import { useSession } from "../auth/session";
import AdminEditLink from "../components/AdminEditLink";
import LoadState from "../components/LoadState";
import ResourceLibrary from "../components/ResourceLibrary";

export default function ResourcesPage() {
  const { content } = useContent();
  const { isSignedIn } = useSession();
  const resources = useResources();
  const catalog = [...content.courses, ...content.examPrepTracks];

  return (
    <section data-page="resources" className="page">
      <div className="page-head">
        <h2>Study resources</h2>
        <p className="lead">
          {isSignedIn
            ? "Everything your tutor has shared: public guides plus material picked for you."
            : "Free worksheets, formula sheets and walkthrough videos. Students get more after signing in."}
        </p>
      </div>
      <LoadState loading={resources.loading} error={resources.error} onRetry={() => void resources.refetch()} />
      {resources.data ? (
        <ResourceLibrary
          resources={resources.data}
          courses={catalog}
          onOpen={resources.open}
          emptyText="New resources are on the way. Check back soon."
        />
      ) : null}
      {!isSignedIn ? (
        <div className="card cta-band section">
          <div>
            <h3>Want the full library?</h3>
            <p>Students get session notes, practice sets and mock exams shared directly with them.</p>
          </div>
          <div className="row">
            <Link className="button-link primary" to="/contact">Start tutoring</Link>
            <Link className="button-link" to="/sign-in?redirect_url=%2Fresources">Sign in</Link>
          </div>
        </div>
      ) : null}
      <AdminEditLink tab="resources" />
    </section>
  );
}
