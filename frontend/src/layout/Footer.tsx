import { Link } from "react-router-dom";
import { useContent } from "../api/ContentProvider";

export default function Footer() {
  const { about } = useContent().content;

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link to="/" className="brand"><span className="brand-icon" aria-hidden="true">∑</span><span>Tutor<b>Pro</b></span></Link>
          <p className="muted">{about.tagline}</p>
        </div>
        <div>
          <h4>Learn</h4>
          <ul>
            <li><Link to="/courses">Courses</Link></li>
            <li><Link to="/exam-prep">Exam prep</Link></li>
            <li><Link to="/resources">Free resources</Link></li>
            <li><Link to="/assessment">Placement assessment</Link></li>
          </ul>
        </div>
        <div>
          <h4>Sessions</h4>
          <ul>
            <li><Link to="/contact">Request tutoring</Link></li>
            <li><Link to="/book">Book a time</Link></li>
            <li><Link to="/dashboard">Student dashboard</Link></li>
            <li><Link to="/policy">Policies</Link></li>
          </ul>
        </div>
        <div>
          <h4>Contact</h4>
          <ul>
            {about.email ? <li><a href={`mailto:${about.email}`}>{about.email}</a></li> : null}
            {about.phone ? <li><a href={`tel:${about.phone.replace(/[^\d+]/g, "")}`}>{about.phone}</a></li> : null}
            {about.location ? <li className="muted">{about.location}</li> : null}
            <li><Link to="/contact">Send a message</Link></li>
          </ul>
        </div>
      </div>
      <div className="container footer-base">
        <small>© {new Date().getFullYear()} TutorPro{about.tutorName ? ` · ${about.tutorName}` : ""}</small>
      </div>
    </footer>
  );
}
