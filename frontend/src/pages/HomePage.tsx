import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StarRating from "../components/StarRating";
import { useAppContext } from "../context/AppContext";

export default function HomePage() {
  const { db, currentUser } = useAppContext();
  const navigate = useNavigate();
  const [faqOpenMap, setFaqOpenMap] = useState<Record<string, boolean>>({});
  const isAdmin = currentUser?.role === "admin";
  const isTutor = currentUser?.role === "tutor";
  const canUseAssessment = !currentUser || currentUser.role === "student" || currentUser.role === "parent";
  const primaryAction = isAdmin || isTutor ? "/dashboard" : "/contact";
  const primaryLabel = isAdmin ? "Open Admin Dashboard" : isTutor ? "Open Tutor Dashboard" : "Get Started";
  const contactLabel = isAdmin ? "Open Contact Operations" : isTutor ? "Open Request Inbox" : "Contact Me";

  return (
    <section data-page="home" className="page">
      <div className="home-grid">
        <div className="home-main">
          <div className="hero hero-banner">
            <div className="hero-copy">
              <p className="hero-kicker">Math and Physics Tutoring</p>
              <h2>Ace Math and Physics with Expert Tutoring</h2>
              <p>Personalized support for University, IB, AP, SAT, and A-Level students.</p>
              <button className="primary" onClick={() => navigate(primaryAction)}>{primaryLabel}</button>
            </div>
          </div>

          <section className="card" id="teaching-style">
            <div className="teaching-grid">
              <div>
                <h3>Teaching Style</h3>
                <p>
                  Concept-first teaching with targeted practice. We break topics into manageable steps,
                  identify gaps quickly, and build confidence through structured solving strategies.
                </p>
                <button className="primary" onClick={() => navigate("/exam-prep")}>Sample Video</button>
              </div>
              <div className="video-wrap">
                <video controls preload="metadata">
                  <source src="assets/sample-lesson.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <p className="muted">If the video cannot load, use an external sample link.</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>Student Reviews</h3>
            <div id="reviews-list" className="list">
              {db.reviews.length ? (
                db.reviews.filter((review) => review.status !== "pending").map((review) => (
                  <div className="list-item" key={review.id}>
                    <strong>{review.name}</strong> <StarRating rating={Number(review.rating)} />
                    <p>{review.text}</p>
                  </div>
                ))
              ) : (
                <div className="list-item muted">No reviews yet</div>
              )}
            </div>
          </section>

          <section className="card">
            <h3>Frequently Asked Questions</h3>
            <div id="faq-list" className="accordion">
              {db.faq.length ? (
                db.faq.map((faq) => (
                  <div className="accordion-item" key={faq.id}>
                    <button className="accordion-q" onClick={() => setFaqOpenMap((prev) => ({ ...prev, [faq.id]: !prev[faq.id] }))}>
                      {faq.question}
                    </button>
                    <div className={`accordion-a ${faqOpenMap[faq.id] ? "" : "hidden"}`}>{faq.answer}</div>
                  </div>
                ))
              ) : (
                <div className="list-item muted">No FAQ items yet.</div>
              )}
            </div>
            <button className="primary" onClick={() => navigate("/contact")}>{contactLabel}</button>
          </section>
        </div>

        <aside className="home-side">
          <section className="card side-panel top">
            <div className="side-head">
              <h3>{currentUser ? "Your Workspace" : "Login to Your Account"}</h3>
              <button className="primary" onClick={() => navigate(currentUser ? "/dashboard" : "/login")}>
                {currentUser ? "Dashboard" : "Login"}
              </button>
            </div>
            <p className="muted">
              {isAdmin
                ? "Manage learners, tutors, courses, requests, and site content."
                : isTutor
                  ? "Review requests and tutor-facing course information."
                  : "Access assessments, booking history, and progress records."}
            </p>
          </section>

          <section className="card side-panel image">
            <h3>Teaching for Physics</h3>
            <p className="muted">Mechanics, algebra, and exam strategy with step-by-step guidance.</p>
            <ul className="quick-links">
              <li><button onClick={() => navigate("/courses")}>{isAdmin ? "Manage courses" : "See course topics"}</button></li>
              <li><button onClick={() => navigate(isAdmin ? "/exam-prep" : canUseAssessment ? "/assessment" : "/dashboard")}>
                {isAdmin ? "Manage exam prep" : canUseAssessment ? "Do assessment" : "Open dashboard"}
              </button></li>
              <li><button onClick={() => navigate("/contact")}>{isAdmin || isTutor ? "Review requests" : "Tutoring request"}</button></li>
            </ul>
          </section>

          <section className="card side-panel">
            <h3>Quick Contact</h3>
            <p className="muted">For consultation and availability.</p>
            <p><strong>Email:</strong> tutor@example.com</p>
            <p><strong>Phone:</strong> +1 (555) 123-4567</p>
          </section>
        </aside>
      </div>
    </section>
  );
}
