import { Link } from "react-router-dom";
import { useContent } from "../api/ContentProvider";
import { useResources } from "../api/hooks";
import { useMe } from "../api/MeProvider";
import { useSession } from "../auth/session";
import LoadState from "../components/LoadState";
import ResourceLibrary from "../components/ResourceLibrary";
import ResourceManager from "../components/ResourceManager";

export default function ResourcesPage() {
  const { isAdmin } = useMe();
  return isAdmin ? <AdminResourcesPage /> : <PublicResourcesPage />;
}

function AdminResourcesPage() {
  return (
    <section data-page="resources" className="page">
      <div className="page-heading">
        <p className="eyebrow">Library</p>
        <h2>Resources</h2>
        <p className="lead">Share worksheets, notes, past papers and videos. Public ones double as free samples on your site.</p>
      </div>
      <ResourceManager />
    </section>
  );
}

function PublicResourcesPage() {
  const { content } = useContent();
  const { isSignedIn } = useSession();
  const resources = useResources();
  const catalog = [...content.courses, ...content.examPrepTracks];
  const all = resources.data ?? [];

  return (
    <section data-page="resources" className="page">
      <div className="page-heading">
        <p className="eyebrow">Free library</p>
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
          resources={all}
          courses={catalog}
          onOpen={resources.open}
          emptyText="New resources are on the way. Check back soon."
        />
      ) : null}
      {!isSignedIn ? (
        <div className="cta-band">
          <div>
            <h3>Want the full library?</h3>
            <p>Students get session notes, practice sets and mock exams shared directly with them.</p>
          </div>
          <div className="row">
            <Link className="button-link primary" to="/contact">Start tutoring</Link>
            <Link className="button-link ghost" to="/sign-in?redirect_url=%2Fresources">Sign in</Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
