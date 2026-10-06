import { Link } from "react-router-dom";
import { useContent } from "../api/ContentProvider";
import AdminEditLink from "../components/AdminEditLink";
import Prose from "../components/Prose";

export default function AboutPage() {
  const { content } = useContent();
  const about = content.pages.about;

  return (
    <section data-page="about" className="page">
      <div className={`about-head ${about.photoUrl ? "" : "no-photo"}`}>
        {about.photoUrl ? <img className="about-photo" src={about.photoUrl} alt="" /> : null}
        <div className="page-head">
          <p className="eyebrow">About</p>
          <h2>{about.title}</h2>
          <Prose text={about.intro} className="lead" />
        </div>
      </div>

      <div className="section-stack">
        {about.sections.map((section) => (
          <div className="card" key={section.id}>
            <h3>{section.heading}</h3>
            <Prose text={section.body} />
          </div>
        ))}
      </div>

      <div className="card cta-band">
        <div>
          <h3>Want to work together?</h3>
          <p>Send a request and I will get back to you.</p>
        </div>
        <Link className="button-link" to="/contact">Contact me</Link>
      </div>

      <AdminEditLink tab="about" />
    </section>
  );
}
