import { Link } from "react-router-dom";
import { InlineWidget, useCalendlyEventListener } from "react-calendly";
import { useContent } from "../api/ContentProvider";
import { envCalendlyUrl } from "../config";

export interface CalendlyPrefill {
  name?: string;
  email?: string;
}

export interface CalendlyUtm {
  utmSource?: string;
  utmMedium?: string;
  utmContent?: string;
}

/** Inline Calendly scheduler for the admin-set booking link (or `VITE_CALENDLY_URL`). Placeholder when neither is set. */
export default function CalendlyEmbed({
  prefill,
  utm,
  onEventScheduled
}: {
  prefill?: CalendlyPrefill;
  utm?: CalendlyUtm;
  onEventScheduled?: () => void;
}) {
  const { content, loaded, error } = useContent();
  useCalendlyEventListener({ onEventScheduled: () => onEventScheduled?.() });

  const calendlyUrl = content.pages.booking.calendlyUrl || envCalendlyUrl;
  // Wait for content so a stale env fallback doesn't load before the admin-set link.
  if (!loaded && !error) return <p className="muted">Loading scheduler...</p>;
  if (!calendlyUrl || calendlyUrl.includes("your-handle")) {
    return (
      <div className="card">
        <h3>Online booking is not set up yet</h3>
        <p className="muted">Please <Link to="/contact">send a request</Link> and we will get back to you with a time.</p>
      </div>
    );
  }

  return (
    <InlineWidget
      key={calendlyUrl}
      url={calendlyUrl}
      prefill={prefill}
      utm={utm}
      styles={{ height: "700px", minWidth: "320px" }}
      iframeTitle="Book a tutoring session"
    />
  );
}
