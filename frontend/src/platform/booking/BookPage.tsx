import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthUser } from "../auth/useAuthUser";
import { CalendlyEmbed, CalendlyEvents } from "./CalendlyEmbed";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public booking page at `/book`.
 *
 * Prefills name/email from the signed-in user when available; anonymous
 * visitors can still book with empty prefill.
 *
 * Linking a booking to a session request:
 *   `/book?request=<uuid>` forwards the id as Calendly UTM `utm_content`.
 *   Calendly stores it on the invitee as `tracking.utm_content`, and the
 *   `invitee.created` webhook handler (root `api/`) reads that field to attach
 *   the scheduled event to the matching `session_requests` row.
 */
export function BookPage() {
  const { isSignedIn, fullName, email } = useAuthUser();
  const [searchParams] = useSearchParams();
  const [scheduled, setScheduled] = useState(false);

  const requestParam = (searchParams.get("request") ?? "").trim();
  const requestId = UUID_RE.test(requestParam) ? requestParam : null;

  const prefill = isSignedIn
    ? { name: fullName ?? undefined, email: email ?? undefined }
    : undefined;

  const utm = {
    utmSource: "tutorpro",
    utmMedium: "web",
    ...(requestId ? { utmContent: requestId } : {})
  };

  return (
    <section data-page="book" className="page">
      <h2>Book a session</h2>
      <p className="muted">Pick a time that works for you. You will receive a confirmation email from Calendly.</p>
      {scheduled ? (
        <div className="card">
          <h3>Booked!</h3>
          <p>Your session is scheduled. Check your inbox for the confirmation and calendar invite.</p>
        </div>
      ) : null}
      <CalendlyEvents onEventScheduled={() => setScheduled(true)} />
      <CalendlyEmbed prefill={prefill} utm={utm} />
    </section>
  );
}

export default BookPage;
