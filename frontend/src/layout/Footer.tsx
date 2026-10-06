import { Link } from "react-router-dom";
import { useContent } from "../api/ContentProvider";

export default function Footer() {
  const { content } = useContent();
  const { email, phone } = content.pages.contact;

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <small>© {new Date().getFullYear()} TutorPro</small>
          {email || phone ? (
            <small>
              {" · "}
              {email ? <a href={`mailto:${email}`}>{email}</a> : null}
              {email && phone ? " · " : null}
              {phone ? <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a> : null}
            </small>
          ) : null}
        </div>
        <nav aria-label="Footer">
          <Link to="/about">About</Link>
          <Link to="/policy">Policy</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/assessment">Free assessment</Link>
        </nav>
      </div>
    </footer>
  );
}
