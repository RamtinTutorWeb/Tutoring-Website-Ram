import { useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../api/ContentProvider";
import { useResources } from "../api/hooks";
import { useMe } from "../api/MeProvider";
import type { Course } from "../api/types";
import LoadState from "../components/LoadState";
import { ResourceCard } from "../components/ResourceLibrary";
import ReviewForm from "../components/ReviewForm";
import StarRating from "../components/StarRating";
import VideoPlayer from "../components/VideoPlayer";

const steps = [
  { title: "Tell me what you need", text: "Send a short request: subject, level, exam date and the topics that feel hardest." },
  { title: "Get a plan", text: "I reply within a day. Optional placement assessment so we start at the right level." },
  { title: "Book your slot", text: "Pick a time that suits you in the online calendar. Reminders arrive automatically." },
  { title: "Learn and keep it", text: "Notes, practice sets and recordings land in your dashboard after every session." }
];

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "∑";
}

function groupByCategory(courses: Course[]): Array<[string, Course[]]> {
  const groups = new Map<string, Course[]>();
  for (const course of courses) groups.set(course.category, [...(groups.get(course.category) ?? []), course]);
  return [...groups.entries()];
}

export default function HomePage() {
  const { content, loading, error, refetch } = useContent();
  const { isAdmin } = useMe();
  const resources = useResources();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const { about } = content;
  const reviews = content.reviews.filter((review) => review.status !== "pending");
  const average = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length : 0;
  const catalog = [...content.courses, ...content.examPrepTracks];
  const categories = groupByCategory(catalog);
  const publicResources = (resources.data ?? []).filter((resource) => resource.visibility === "public");
  const showcase = [...publicResources.filter((r) => r.featured), ...publicResources.filter((r) => !r.featured)].slice(0, 3);

  return (
    <div data-page="home" className="home">
      {isAdmin ? (
        <div className="admin-bar" role="note">
          You're viewing your public site. <Link to="/settings">Edit profile & content</Link> · <Link to="/resources">Manage resources</Link>
        </div>
      ) : null}

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Math & Physics Tutoring{about.location ? ` · ${about.location}` : ""}</p>
          <h1>{about.headline}</h1>
          <p className="hero-tagline">{about.tagline}</p>
          <div className="hero-actions">
            <Link className="button-link primary large" to="/contact">Book a free consultation</Link>
            <Link className="button-link ghost large" to="/assessment">Take the free assessment</Link>
          </div>
          {reviews.length ? (
            <a className="hero-proof" href="#reviews">
              <StarRating rating={Math.round(average)} />
              <span><strong>{average.toFixed(1)}</strong> from {reviews.length} student review{reviews.length === 1 ? "" : "s"}</span>
            </a>
          ) : null}
        </div>
        <div className="hero-visual" aria-hidden={!about.photoUrl}>
          <div className="hero-orbit">
            {about.photoUrl ? (
              <img className="hero-photo" src={about.photoUrl} alt={about.tutorName ? `${about.tutorName}, tutor` : "Your tutor"} />
            ) : (
              <div className="hero-monogram">{initials(about.tutorName)}</div>
            )}
            <span className="float-chip chip-a">∫ f(x) dx</span>
            <span className="float-chip chip-b">F = ma</span>
            <span className="float-chip chip-c">e<sup>iπ</sup> + 1 = 0</span>
          </div>
        </div>
      </section>

      {about.stats.length ? (
        <section className="stat-strip" aria-label="At a glance">
          {about.stats.map((stat) => (
            <div className="stat-strip-item" key={stat.id}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>
      ) : null}

      <LoadState loading={loading && !content.courses.length} error={error} onRetry={() => void refetch()} />

      {categories.length ? (
        <section className="section" id="subjects">
          <div className="section-head">
            <p className="eyebrow">What I teach</p>
            <h2>Courses & exam tracks</h2>
          </div>
          <div className="subject-grid">
            {categories.map(([category, courses]) => (
              <article className="subject-card" key={category}>
                <h3>{category}</h3>
                <ul>
                  {courses.slice(0, 5).map((course) => <li key={course.id}>{course.title}</li>)}
                  {courses.length > 5 ? <li className="muted">+{courses.length - 5} more</li> : null}
                </ul>
                <Link className="text-link" to={category === "Exam Prep" ? "/exam-prep" : "/courses"}>Explore {category.toLowerCase()} →</Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section" id="how-it-works">
        <div className="section-head">
          <p className="eyebrow">How it works</p>
          <h2>From first message to first “aha”</h2>
        </div>
        <ol className="steps">
          {steps.map((step, index) => (
            <li className="step" key={step.title}>
              <span className="step-num">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section about-section" id="about">
        <div className="about-copy">
          <p className="eyebrow">About{about.tutorName ? ` ${about.tutorName}` : ""}</p>
          <h2>Concept-first teaching that sticks</h2>
          {about.bio ? about.bio.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>) : null}
          {about.highlights.length ? (
            <ul className="checklist">
              {about.highlights.map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : null}
          <Link className="button-link primary" to="/contact">Work with me</Link>
        </div>
        <div className="about-media">
          {about.videoUrl ? (
            <VideoPlayer url={about.videoUrl} title="Sample lesson" />
          ) : (
            <div className="formula-board" aria-hidden="true">
              <span>d/dx (sin x) = cos x</span>
              <span>v² = u² + 2as</span>
              <span>Σ 1/n² = π²/6</span>
              <span>∇ · E = ρ / ε₀</span>
            </div>
          )}
        </div>
      </section>

      {showcase.length ? (
        <section className="section" id="free-resources">
          <div className="section-head split">
            <div>
              <p className="eyebrow">Free resources</p>
              <h2>Try a sample of my material</h2>
            </div>
            <Link className="button-link ghost" to="/resources">Browse the library →</Link>
          </div>
          <div className="resource-grid">
            {showcase.map((resource) => <ResourceCard key={resource.id} resource={resource} onOpen={resources.open} />)}
          </div>
        </section>
      ) : null}

      <section className="section" id="reviews">
        <div className="section-head">
          <p className="eyebrow">Student reviews</p>
          <h2>{reviews.length ? "What students say" : "Reviews"}</h2>
        </div>
        {reviews.length ? (
          <div className="review-grid">
            {reviews.map((review) => (
              <figure className="review-card" key={review.id}>
                <StarRating rating={Number(review.rating)} />
                <blockquote>{review.text}</blockquote>
                <figcaption>{review.name}</figcaption>
              </figure>
            ))}
          </div>
        ) : !loading ? (
          <div className="empty-state">No reviews yet. Be the first to share how your sessions went.</div>
        ) : null}
        <ReviewForm />
      </section>

      {content.faq.length ? (
        <section className="section faq-section" id="faq">
          <div className="section-head">
            <p className="eyebrow">FAQ</p>
            <h2>Good questions</h2>
          </div>
          <div className="accordion">
            {content.faq.map((faq) => (
              <div className={`accordion-item ${openFaq === faq.id ? "open" : ""}`} key={faq.id}>
                <button
                  type="button"
                  className="accordion-q"
                  aria-expanded={openFaq === faq.id}
                  onClick={() => setOpenFaq((current) => (current === faq.id ? null : faq.id))}
                >
                  {faq.question}
                </button>
                <div className={`accordion-a ${openFaq === faq.id ? "" : "hidden"}`}>{faq.answer}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="cta-band final-cta">
        <div>
          <h2>Ready for your next grade jump?</h2>
          <p>Start with a free consultation. No commitment, just a plan.</p>
          {about.email || about.phone ? (
            <p className="cta-contact">
              {about.email ? <a href={`mailto:${about.email}`}>{about.email}</a> : null}
              {about.email && about.phone ? " · " : null}
              {about.phone ? <a href={`tel:${about.phone.replace(/[^\d+]/g, "")}`}>{about.phone}</a> : null}
            </p>
          ) : null}
        </div>
        <div className="row">
          <Link className="button-link primary large" to="/contact">Get started</Link>
          <Link className="button-link ghost large" to="/book">See availability</Link>
        </div>
      </section>
    </div>
  );
}
