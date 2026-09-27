import { InlineWidget, useCalendlyEventListener } from "react-calendly";
import { calendlyUrl } from "../config";

export interface CalendlyPrefill {
  name?: string;
  email?: string;
}

export interface CalendlyUtm {
  utmSource?: string;
  utmMedium?: string;
  utmContent?: string;
}

/** Inline Calendly scheduler for `VITE_CALENDLY_URL`. Renders a placeholder when it is unset. */
export default function CalendlyEmbed({
  prefill,
  utm,
  onEventScheduled
}: {
  prefill?: CalendlyPrefill;
  utm?: CalendlyUtm;
  onEventScheduled?: () => void;
}) {
  useCalendlyEventListener({ onEventScheduled: () => onEventScheduled?.() });

  if (!calendlyUrl) {
    return (
      <div className="card">
        <h3>Booking not configured</h3>
        <p className="muted">
          Set <code>VITE_CALENDLY_URL</code> to your Calendly event link (for example{" "}
          <code>https://calendly.com/your-handle/tutoring-session</code>) to enable online booking.
        </p>
      </div>
    );
  }

  return (
    <InlineWidget
      url={calendlyUrl}
      prefill={prefill}
      utm={utm}
      styles={{ height: "700px", minWidth: "320px" }}
      iframeTitle="Book a tutoring session"
    />
  );
}
