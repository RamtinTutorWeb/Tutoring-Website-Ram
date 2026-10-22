import { useContent } from "../api/ContentProvider";
import { useMe } from "../api/MeProvider";
import LoadState from "../components/LoadState";
import { PolicyEditor } from "./settings/editors";

export default function PolicyPage() {
  const { content, loading, error, refetch } = useContent();
  const { isAdmin } = useMe();

  return (
    <section data-page="policy" className="page">
      <div className="page-heading">
        <p className="eyebrow">The fine print</p>
        <h2>Policies</h2>
      </div>
      <LoadState loading={loading} error={error} onRetry={() => void refetch()} />
      <div className="policy-grid">
        {content.policySections.map((section) => (
          <article className="card policy-card" key={section.id}>
            <h3>{section.title}</h3>
            {section.body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </article>
        ))}
      </div>
      {isAdmin ? <PolicyEditor /> : null}
    </section>
  );
}
