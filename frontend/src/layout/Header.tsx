import { NavLink, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

export default function Header() {
  const { currentUser, logout } = useAppContext();
  const navigate = useNavigate();
  const canUseAssessment = !currentUser || currentUser.role === "student" || currentUser.role === "parent" || currentUser.role === "admin";
  const contactLabel = currentUser?.role === "admin" ? "Contact Ops" : currentUser?.role === "tutor" ? "Requests" : "Contact";

  return (
    <header className="site-header">
      <div className="container header-inner">
        <h1 className="brand">
          <span className="brand-icon" aria-hidden="true" /> TutorPro
        </h1>
        <nav>
          <ul className="nav-links" id="main-nav">
            <li><NavLink to="/" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Home</NavLink></li>
            <li><NavLink to="/courses" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Courses</NavLink></li>
            <li><NavLink to="/exam-prep" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Exam Prep</NavLink></li>
            {canUseAssessment ? (
              <li><NavLink to="/assessment" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Assessment</NavLink></li>
            ) : null}
            <li><NavLink to="/contact" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>{contactLabel}</NavLink></li>
            <li><NavLink to="/policy" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Policy</NavLink></li>
            <li>
              {currentUser ? (
                <button
                  type="button"
                  className="nav-btn"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Logout ({currentUser.name})
                </button>
              ) : (
                <NavLink to="/login" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Login</NavLink>
              )}
            </li>
            {currentUser ? (
              <li><NavLink to="/dashboard" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Dashboard</NavLink></li>
            ) : null}
          </ul>
        </nav>
      </div>
    </header>
  );
}
