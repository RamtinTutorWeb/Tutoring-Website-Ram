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
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand">
          <span className="brand-icon" aria-hidden="true" /> TutorPro
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
        <nav className={open ? "open" : ""}>
          <ul className="nav-links" id="main-nav">
            <li><NavLink to="/" end className={navClass}>Home</NavLink></li>
            <li><NavLink to="/about" className={navClass}>About</NavLink></li>
            <li><NavLink to="/courses" className={navClass}>Courses</NavLink></li>
            <li><NavLink to="/exam-prep" className={navClass}>Exam Prep</NavLink></li>
            <li><NavLink to="/policy" className={navClass}>Policy</NavLink></li>
            <li><NavLink to="/contact" className={navClass}>Contact</NavLink></li>
            {isAdmin ? <li><NavLink to="/admin" className={navClass}>Admin</NavLink></li> : null}
            {isSignedIn && !isAdmin ? <li><NavLink to="/dashboard" className={navClass}>Dashboard</NavLink></li> : null}
            {!isSignedIn ? <li><NavLink to="/sign-in" className={navClass}>Sign In</NavLink></li> : null}
            <li className="nav-cta"><Link className="button-link primary" to="/book">Book a session</Link></li>
            {configured && isSignedIn ? <li className="nav-user"><UserButton /></li> : null}
          </ul>
        </nav>
      </div>
    </header>
  );
}
