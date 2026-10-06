import { useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../api/ContentProvider";
import AdminEditLink from "../components/AdminEditLink";
import LoadState from "../components/LoadState";
import Prose from "../components/Prose";
import ReviewForm from "../components/ReviewForm";
import StarRating from "../components/StarRating";
import VideoEmbed from "../components/VideoEmbed";

export default function HomePage() {
  const { content, loading, error, refetch } = useContent();
  const [faqOpenMap, setFaqOpenMap] = useState<Record<string, boolean>>({});
  const home = content.pages.home;
  const approvedReviews = content.reviews.filter((review) => review.status !== "pending");

  return (
    <section data-page="home" className="page">
      <div className="hero">
        <p className="hero-kicker">{home.kicker}</p>
        <h2>{home.title}</h2>
        <p className="lead">{home.subtitle}</p>
        <div className="row">
          <Link className="button-link primary" to="/contact">Request a session</Link>
          <Link className="button-link" to="/about">About me</Link>
        </div>
      </div>

      <div className="card-grid">
        <Link className="card card-link" to="/courses">
          <h3>Courses</h3>
          <p className="muted">University and high school math and physics, topic by topic.</p>
          <span className="arrow">Browse courses →</span>
        </Link>
        <Link className="card card-link" to="/exam-prep">
          <h3>Exam prep</h3>
          <p className="muted">SAT, AP, IB, and A-Level prep with timed practice and mock sessions.</p>
          <span className="arrow">See exam prep →</span>
        </Link>
        <Link className="card card-link" to="/assessment">
          <h3>Free assessment</h3>
          <p className="muted">A short placement test so we know where to start.</p>
          <span className="arrow">Take the assessment →</span>
        </Link>
      </div>

      <section className="card section" id="teaching-style">
        <div className={`teaching-grid ${home.videoUrl ? "" : "single"}`}>
          <div>
            <h3>{home.teachingTitle}</h3>
            <Prose text={home.teachingText} className="muted" />
          </div>
          <VideoEmbed url={home.videoUrl} title="Sample lesson" />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h3>What students say</h3>
        </div>
        <LoadState loading={loading} error={error} onRetry={() => void refetch()} />
        <div id="reviews-list" className="card-grid">
          {approvedReviews.map((review) => (
            <div className="card review-card" key={review.id}>
              <StarRating rating={Number(review.rating)} />
              <p>{review.text}</p>
              <p className="muted">— {review.name}</p>
            </div>
          ))}
        </div>
        {!approvedReviews.length && !loading ? <p className="muted">No reviews yet.</p> : null}
        <div className="section-stack" style={{ marginTop: "1rem" }}>
          <ReviewForm />
        </div>
      </section>

      {content.faq.length ? (
        <section className="section">
          <h3>Frequently asked questions</h3>
          <div id="faq-list" className="accordion">
            {content.faq.map((faq) => (
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
            ))}
          </div>
        </section>
      ) : null}

      <div className="card cta-band section">
        <div>
          <h3>Ready to get started?</h3>
          <p>Tell me what you are working on and I will get back to you.</p>
        </div>
        <Link className="button-link" to="/contact">Contact me</Link>
      </div>

      <AdminEditLink tab="home" />
    </section>
  );
}
