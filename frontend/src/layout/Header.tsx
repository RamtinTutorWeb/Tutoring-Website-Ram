import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

export default function Header() {
  const { currentUser, logout } = useAppContext();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const canUseAssessment = !currentUser || currentUser.role !== "admin";
  const contactLabel = currentUser?.role === "admin" ? "Contact Ops" : "Contact";

  function confirmLogout(): void {
    logout();
    setShowLogoutConfirm(false);
    navigate("/");
  }

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
            {currentUser ? (
              <li><NavLink to="/dashboard" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Dashboard</NavLink></li>
            ) : null}
            {currentUser?.role === "admin" ? (
              <li><NavLink to="/settings" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Settings</NavLink></li>
            ) : null}
            {currentUser && currentUser.role !== "admin" ? (
              <li><NavLink to="/profile" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Profile</NavLink></li>
            ) : null}
            {!currentUser ? (
              <li><NavLink to="/login" className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}>Login</NavLink></li>
            ) : null}
          </ul>
        </nav>
      </div>
      {currentUser ? (
        <button type="button" className="nav-btn logout-btn floating-logout" onClick={() => setShowLogoutConfirm(true)}>
          Logout ({currentUser.name})
        </button>
      ) : null}
      {showLogoutConfirm ? (
        <div className="logout-confirm-backdrop" role="presentation">
          <div className="card logout-confirm" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
            <div className="logout-confirm-icon" aria-hidden="true">↪</div>
            <p className="hero-kicker">Account session</p>
            <h2 id="logout-confirm-title">Ready to log out?</h2>
            <p className="logout-confirm-copy">
              You are currently signed in as <strong>{currentUser.name}</strong>. You will need to enter your credentials again to return to your dashboard.
            </p>
            <div className="logout-confirm-actions">
              <button className="danger" type="button" onClick={confirmLogout}>Log Out</button>
              <button type="button" onClick={() => setShowLogoutConfirm(false)}>Stay Signed In</button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
