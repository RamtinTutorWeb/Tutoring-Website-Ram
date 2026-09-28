import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContent } from "../api/ContentProvider";
import { useMe } from "../api/MeProvider";
import LoadState from "../components/LoadState";
import ReviewForm from "../components/ReviewForm";
import StarRating from "../components/StarRating";
import { useSession } from "../auth/session";

export default function HomePage() {
  const { content, loading, error, refetch } = useContent();
  const { isSignedIn } = useSession();
  const { isAdmin } = useMe();
  const navigate = useNavigate();
  const [faqOpenMap, setFaqOpenMap] = useState<Record<string, boolean>>({});
  const approvedReviews = content.reviews.filter((review) => review.status !== "pending");
  const primaryAction = isAdmin ? "/dashboard" : "/contact";
  const primaryLabel = isAdmin ? "Open Admin Dashboard" : "Get Started";
  const contactLabel = isAdmin ? "Open Contact Operations" : "Contact Me";

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
            <LoadState loading={loading} error={error} onRetry={() => void refetch()} />
            <div id="reviews-list" className="list">
              {approvedReviews.length ? (
                approvedReviews.map((review) => (
                  <div className="list-item" key={review.id}>
                    <strong>{review.name}</strong> <StarRating rating={Number(review.rating)} />
                    <p>{review.text}</p>
                  </div>
                ))
              ) : !loading ? (
                <div className="list-item muted">No reviews yet</div>
              ) : null}
            </div>
          </section>

          <ReviewForm />

          <section className="card">
            <h3>Frequently Asked Questions</h3>
            <div id="faq-list" className="accordion">
              {content.faq.length ? (
                content.faq.map((faq) => (
                  <div className="accordion-item" key={faq.id}>
                    <button
                      className="accordion-q"
                      aria-expanded={Boolean(faqOpenMap[faq.id])}
                      onClick={() => setFaqOpenMap((prev) => ({ ...prev, [faq.id]: !prev[faq.id] }))}
                    >
                      {faq.question}
                    </button>
                    <div className={`accordion-a ${faqOpenMap[faq.id] ? "" : "hidden"}`}>{faq.answer}</div>
                  </div>
                ))
              ) : !loading ? (
                <div className="list-item muted">No FAQ items yet.</div>
              ) : null}
            </div>
            <button className="primary" onClick={() => navigate("/contact")}>{contactLabel}</button>
          </section>
        </div>

        <aside className="home-side">
          <section className="card side-panel top">
            <div className="side-head">
              <h3>{isSignedIn ? "Your Workspace" : "Sign In to Your Account"}</h3>
              <button className="primary" onClick={() => navigate(isSignedIn ? "/dashboard" : "/sign-in")}>
                {isSignedIn ? "Dashboard" : "Sign In"}
              </button>
            </div>
            <p className="muted">
              {isAdmin
                ? "Manage students, courses, requests, and site content."
                : "Access assessments, bookings, and progress records."}
            </p>
          </section>

          <section className="card side-panel image">
            <h3>Teaching for Physics</h3>
            <p className="muted">Mechanics, algebra, and exam strategy with step-by-step guidance.</p>
            <ul className="quick-links">
              <li><button onClick={() => navigate("/courses")}>{isAdmin ? "Manage courses" : "See course topics"}</button></li>
              <li><button onClick={() => navigate(isAdmin ? "/exam-prep" : "/assessment")}>
                {isAdmin ? "Manage exam prep" : "Do assessment"}
              </button></li>
              <li><button onClick={() => navigate(isAdmin ? "/dashboard" : "/contact")}>{isAdmin ? "Review requests" : "Tutoring request"}</button></li>
            </ul>
          </section>

          <section className="card side-panel">
            <h3>Quick Contact</h3>
            <p className="muted">For consultation and availability.</p>
            <p><strong>Email:</strong> contact@example.com</p>
            <p><strong>Phone:</strong> +1 (555) 123-4567</p>
          </section>
        </aside>
      </div>
    </section>
  );
}
