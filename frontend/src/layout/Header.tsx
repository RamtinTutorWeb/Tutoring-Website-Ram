import { UserButton } from "@clerk/react";
import { NavLink } from "react-router-dom";
import { useMe } from "../api/MeProvider";
import { useSession } from "../auth/session";

function navClass({ isActive }: { isActive: boolean }): string {
  return `nav-btn ${isActive ? "active" : ""}`;
}

export default function Header() {
  const { configured, isSignedIn } = useSession();
  const { isAdmin } = useMe();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <h1 className="brand">
          <span className="brand-icon" aria-hidden="true" /> TutorPro
        </h1>
        <nav>
          <ul className="nav-links" id="main-nav">
            <li><NavLink to="/" end className={navClass}>Home</NavLink></li>
            <li><NavLink to="/courses" className={navClass}>Courses</NavLink></li>
            <li><NavLink to="/exam-prep" className={navClass}>Exam Prep</NavLink></li>
            {!isAdmin ? <li><NavLink to="/assessment" className={navClass}>Assessment</NavLink></li> : null}
            <li><NavLink to="/contact" className={navClass}>{isAdmin ? "Contact Ops" : "Contact"}</NavLink></li>
            <li><NavLink to="/book" className={navClass}>Book</NavLink></li>
            <li><NavLink to="/policy" className={navClass}>Policy</NavLink></li>
            {isSignedIn ? <li><NavLink to="/dashboard" className={navClass}>Dashboard</NavLink></li> : null}
            {isAdmin ? <li><NavLink to="/settings" className={navClass}>Settings</NavLink></li> : null}
            {isSignedIn && !isAdmin ? <li><NavLink to="/profile" className={navClass}>Profile</NavLink></li> : null}
            {!isSignedIn ? <li><NavLink to="/sign-in" className={navClass}>Sign In</NavLink></li> : null}
            {configured && isSignedIn ? <li className="nav-user"><UserButton /></li> : null}
          </ul>
        </nav>
      </div>
    </header>
  );
}
