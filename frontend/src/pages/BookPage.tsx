import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useContent } from "../api/ContentProvider";
import { useMe } from "../api/MeProvider";
import { useSession } from "../auth/session";
import CalendlyEmbed from "../components/CalendlyEmbed";

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * `/book?request=<id>` forwards the request id to Calendly as `utm_content`; the backend's
 * `/webhooks/calendly` handler reads it back to link the booking and mark the request scheduled.
 */
export default function BookPage() {
  const { isSignedIn, fullName, email } = useSession();
  const { me } = useMe();
  const { content } = useContent();
  const [searchParams] = useSearchParams();
  const [scheduled, setScheduled] = useState(false);

  const requestParam = (searchParams.get("request") ?? "").trim();
  const requestId = REQUEST_ID_RE.test(requestParam) ? requestParam : null;
  const name = me?.fullName || fullName;
  const mail = me?.email || email;
  const prefill = isSignedIn ? { name: name ?? undefined, email: mail ?? undefined } : undefined;
  const utm = { utmSource: "tutorpro", utmMedium: "web", ...(requestId ? { utmContent: requestId } : {}) };

  return (
    <section data-page="book" className="page">
      <h2>Book a session</h2>
      <p className="muted">
        {requestId
          ? "Your request was accepted. Pick a time that works for you; Calendly will email your confirmation."
          : <>{content.pages.booking.intro} New students should <Link to="/contact">send a request</Link> first.</>}
      </p>
      {scheduled ? (
        <div className="card" role="status">
          <h3>Booked!</h3>
          <p>Your session is scheduled. Check your inbox for the confirmation and calendar invite.</p>
          {isSignedIn ? <Link className="button-link primary" to="/dashboard">Go To Dashboard</Link> : null}
        </div>
      ) : null}
      {/* Remount when the prefill resolves: InlineWidget only reads props on mount. */}
      <CalendlyEmbed key={`${name ?? ""}|${mail ?? ""}`} prefill={prefill} utm={utm} onEventScheduled={() => setScheduled(true)} />
    </section>
  );
}
