import { UserButton } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useMe } from "../api/MeProvider";
import { useSession } from "../auth/session";

function navClass({ isActive }: { isActive: boolean }): string {
  return `nav-btn ${isActive ? "active" : ""}`;
}

export default function Header() {
  const { configured, isSignedIn } = useSession();
  const { isAdmin } = useMe();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="TutorPro home">
          <span className="brand-icon" aria-hidden="true">∑</span>
          <span>Tutor<b>Pro</b></span>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span /><span /><span />
        </button>
        <nav className={open ? "open" : ""} aria-label="Main">
          <ul className="nav-links" id="main-nav">
            <li><NavLink to="/" end className={navClass}>Home</NavLink></li>
            <li><NavLink to="/courses" className={navClass}>Courses</NavLink></li>
            <li><NavLink to="/exam-prep" className={navClass}>Exam Prep</NavLink></li>
            <li><NavLink to="/resources" className={navClass}>Resources</NavLink></li>
            {!isAdmin ? <li><NavLink to="/assessment" className={navClass}>Assessment</NavLink></li> : null}
            {isAdmin ? <li><NavLink to="/contact" className={navClass}>Requests</NavLink></li> : null}
            {isSignedIn ? <li><NavLink to="/dashboard" className={navClass}>Dashboard</NavLink></li> : null}
            {isAdmin ? <li><NavLink to="/settings" className={navClass}>Settings</NavLink></li> : null}
            {isSignedIn && !isAdmin ? <li><NavLink to="/profile" className={navClass}>Profile</NavLink></li> : null}
            {!isSignedIn ? <li><NavLink to="/sign-in" className={navClass}>Sign in</NavLink></li> : null}
            {!isAdmin ? <li><Link to="/contact" className="button-link primary nav-cta">Book a session</Link></li> : null}
            {configured && isSignedIn ? <li className="nav-user"><UserButton /></li> : null}
          </ul>
        </nav>
      </div>
    </header>
  );
}
