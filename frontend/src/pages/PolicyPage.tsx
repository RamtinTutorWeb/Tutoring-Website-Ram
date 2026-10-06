import { useContent } from "../api/ContentProvider";
import AdminEditLink from "../components/AdminEditLink";
import Prose from "../components/Prose";

export default function PolicyPage() {
  const { content } = useContent();
  const policy = content.pages.policy;

  return (
    <section data-page="policy" className="page">
      <div className="page-head">
        <h2>Policies</h2>
        <Prose text={policy.intro} className="lead" />
      </div>
      <div className="section-stack">
        {policy.sections.map((section) => (
          <div className="card" key={section.id}>
            <h3>{section.heading}</h3>
            <Prose text={section.body} />
          </div>
        ))}
      </div>
      <AdminEditLink tab="policy" />
    </section>
  );
}
