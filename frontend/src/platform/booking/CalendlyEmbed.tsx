import { InlineWidget, useCalendlyEventListener } from "react-calendly";
import type { EventScheduledEvent } from "react-calendly";
import { calendlyUrl as configuredCalendlyUrl, isCalendlyConfigured } from "../config";

export interface CalendlyPrefill {
  name?: string;
  email?: string;
}

export interface CalendlyUtm {
  utmCampaign?: string;
  utmSource?: string;
  utmMedium?: string;
  utmContent?: string;
  utmTerm?: string;
}

export interface CalendlyEmbedProps {
  /** Calendly scheduling URL. Defaults to `VITE_CALENDLY_URL`. */
  url?: string;
  prefill?: CalendlyPrefill;
  utm?: CalendlyUtm;
  /** Iframe height in px. */
  height?: number;
}

/** Inline Calendly scheduler. Renders a placeholder when no URL is configured. */
export function CalendlyEmbed({ url, prefill, utm, height = 700 }: CalendlyEmbedProps) {
  const resolvedUrl = (url ?? "").trim() || configuredCalendlyUrl;

  if (!resolvedUrl) {
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
      url={resolvedUrl}
      prefill={prefill}
      utm={utm}
      styles={{ height: `${height}px`, minWidth: "320px" }}
      iframeTitle="Book a tutoring session"
    />
  );
}

export type CalendlyEventScheduledPayload = EventScheduledEvent["data"]["payload"];

export interface CalendlyEventsProps {
  /** Fires when the visitor completes a booking in the embedded widget. */
  onEventScheduled?: (payload: CalendlyEventScheduledPayload) => void;
  onDateAndTimeSelected?: () => void;
}

/**
 * Renderless helper that forwards `react-calendly`'s postMessage listener.
 * Mount it anywhere on the same page as a `CalendlyEmbed`.
 */
export function CalendlyEvents({ onEventScheduled, onDateAndTimeSelected }: CalendlyEventsProps) {
  useCalendlyEventListener({
    onEventScheduled: (e) => onEventScheduled?.(e.data.payload),
    onDateAndTimeSelected: () => onDateAndTimeSelected?.()
  });
  return null;
}

export { isCalendlyConfigured };
