import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../api/ContentProvider";
import { ApiError, errorMessage } from "../api/client";
import { useCreateRequest } from "../api/hooks";
import { useMe } from "../api/MeProvider";
import type { NewRequest, SessionRequest } from "../api/types";
import { useSession } from "../auth/session";
import AdminEditLink from "../components/AdminEditLink";
import Prose from "../components/Prose";

export default function ContactPage() {
  const { content } = useContent();
  const contact = content.pages.contact;
  const [submitted, setSubmitted] = useState<SessionRequest | null>(null);

  return (
    <section data-page="contact" className="page">
      <div className="page-head">
        <h2>Contact</h2>
        <Prose text={contact.intro} className="lead" />
      </div>
      <div className="contact-layout">
        {submitted ? <RequestSent request={submitted} onReset={() => setSubmitted(null)} /> : <ContactRequestForm onSubmitted={setSubmitted} />}
        <aside className="card contact-side">
          <h3>{contact.email || contact.phone ? "Other ways to reach me" : "Booking"}</h3>
          {contact.email ? <p><strong>Email:</strong> <a href={`mailto:${contact.email}`}>{contact.email}</a></p> : null}
          {contact.phone ? <p><strong>Phone:</strong> <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>{contact.phone}</a></p> : null}
          <p className="muted">Already accepted? <Link to="/book">Book a time</Link>.</p>
        </aside>
      </div>
      <AdminEditLink tab="contact" />
    </section>
  );
}

function RequestSent({ request, onReset }: { request: SessionRequest; onReset: () => void }) {
  const { isSignedIn } = useSession();

  return (
    <div className="card" id="contact-success" role="status">
      <h3>Request sent</h3>
      <p>Thanks, {request.name}. We received your request and will reply to <strong>{request.email}</strong> shortly.</p>
      <p className="muted">
        {isSignedIn
          ? "You can follow its status in your dashboard. When it is accepted, a Book now button appears there."
          : "When it is accepted you will receive an email with a link to book your session."}
      </p>
      <div className="row">
        {isSignedIn ? <Link className="button-link primary" to="/dashboard">Go To Dashboard</Link> : null}
        <button type="button" onClick={onReset}>Send Another Request</button>
      </div>
    </div>
  );
}

function ContactRequestForm({ onSubmitted }: { onSubmitted: (request: SessionRequest) => void }) {
  const { content } = useContent();
  const { isSignedIn, fullName, email } = useSession();
  const { me } = useMe();
  const createRequest = useCreateRequest();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const options = content.selectableOptions;
  const defaultName = me?.fullName || fullName || "";
  const defaultEmail = me?.email || email || "";
  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (key: string) => String(fd.get(key) ?? "").trim();
    const request: NewRequest = {
      name: text("name"),
      email: text("email"),
      phone: text("phone"),
      contactMethod: text("contactMethod"),
      serviceType: text("serviceType"),
      subject: text("subject"),
      urgencyWindow: text("urgencyWindow"),
      isUrgent: fd.get("isUrgent") === "on",
      hardTopics: text("hardTopics"),
      earliestDate: text("earliestDate") || undefined,
      message: text("message"),
      consultation: fd.get("consultation") === "on"
    };
    if (!/.+@.+\..+/.test(request.email)) {
      setFeedback("Please enter a valid email.");
      return;
    }

    setSubmitting(true);
    setFeedback("");
    try {
      onSubmitted(await createRequest(request));
    } catch (err) {
      // Server-side failures are not actionable for the visitor: point them to a direct channel instead.
      const serverDown = err instanceof ApiError && (err.status === 0 || err.status >= 500);
      const direct = content.pages.contact.email ? ` You can also email ${content.pages.contact.email}.` : "";
      setFeedback(serverDown
        ? `We couldn't send your request right now. Please try again in a few minutes.${direct}`
        : errorMessage(err, "Could not send your request. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  // Remount when the signed-in profile arrives so the defaultValues prefill.
  const formKey = isSignedIn ? `signed-in-${defaultEmail}` : "signed-out";

  return (
    <form id="contact-form" className="card form-grid" onSubmit={handleSubmit} key={formKey}>
      <label>Name<input name="name" defaultValue={defaultName} autoComplete="name" required /></label>
      <label>Email<input name="email" type="email" defaultValue={defaultEmail} autoComplete="email" required /></label>
      <label>Phone<input name="phone" type="tel" defaultValue={me?.phone ?? ""} autoComplete="tel" /></label>
      <label>Best way to contact
        <select name="contactMethod" defaultValue="">
          <option value="">Select...</option>
          {options.contactMethods.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>Service type
        <select name="serviceType" defaultValue="">
          <option value="">Select...</option>
          {options.serviceTypes.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>Subject
        <select name="subject" defaultValue="">
          <option value="">Select...</option>
          {options.assessmentSubjects.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>Upcoming exam
        <select name="urgencyWindow" defaultValue="">
          <option value="">No exam / not sure</option>
          {options.urgencyWindows.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>Earliest start date<input name="earliestDate" type="date" min={today} /></label>
      <label className="full">Topics you find hard<input name="hardTopics" placeholder="e.g. integration by parts, projectile motion" /></label>
      <label className="full">Message<textarea name="message" required rows={4} /></label>
      <label className="check-row full"><input name="isUrgent" type="checkbox" /> This is urgent</label>
      <label className="check-row full"><input name="consultation" type="checkbox" /> I'd like a free consultation first</label>
      <label className="check-row full"><input name="notRobot" type="checkbox" required /> I'm not a robot</label>
      <div className="full">
        <button className="primary" type="submit" disabled={submitting}>{submitting ? "Sending..." : "Send request"}</button>
        <p className={`feedback ${feedback ? "error" : ""}`} role="alert">{feedback}</p>
      </div>
    </form>
  );
}
