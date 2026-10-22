import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useContent } from "../api/ContentProvider";
import { useCreateRequest, useRequests } from "../api/hooks";
import { useMe } from "../api/MeProvider";
import type { NewRequest, SessionRequest } from "../api/types";
import { useSession } from "../auth/session";
import StatCard from "../components/StatCard";
import Turnstile from "../components/Turnstile";
import { turnstileSiteKey } from "../config";
import RequestsCard from "./dashboard/RequestsCard";
import { OptionsEditor } from "./settings/editors";

export default function ContactPage() {
  const { isAdmin } = useMe();
  return isAdmin ? <ContactOperations /> : <ContactRequestPage />;
}

function ContactOperations() {
  const requests = useRequests();
  const all = requests.data ?? [];

  return (
    <section data-page="contact" className="page">
      <h2>Contact Operations</h2>
      <p className="muted">Review tutoring requests and manage contact-form choices.</p>

      <div className="grid-2">
        <StatCard label="New" value={all.filter((request) => request.status === "new").length} />
        <StatCard label="Awaiting Booking" value={all.filter((request) => request.status === "accepted").length} />
      </div>

      <div className="grid-2">
        <RequestsCard
          requests={all}
          loading={requests.loading}
          error={requests.error}
          onRetry={() => void requests.refetch()}
          updateStatus={requests.updateStatus}
          defaultFilter="new"
          collapsible={false}
        />
        <OptionsEditor title="Manage Contact Form Choices" groups={["contactMethods", "serviceTypes", "urgencyWindows"]} />
      </div>
    </section>
  );
}

function ContactRequestPage() {
  const [submitted, setSubmitted] = useState<SessionRequest | null>(null);
  const { about } = useContent().content;

  return (
    <section data-page="contact" className="page">
      <div className="contact-layout">
        <aside className="contact-aside">
          <p className="eyebrow">Get started</p>
          <h2>Tell me what you need</h2>
          <p className="lead">A couple of minutes now saves a whole session later. I usually reply within a day.</p>
          <ol className="mini-steps">
            <li><strong>You send a request</strong><span>Subject, level, exam date and the topics that feel hardest.</span></li>
            <li><strong>I review and accept it</strong><span>You get an email with a link to pick a time.</span></li>
            <li><strong>You book online</strong><span>Calendly sends the confirmation and reminders.</span></li>
          </ol>
          {about.email || about.phone ? (
            <div className="contact-direct">
              <h4>Prefer to reach out directly?</h4>
              {about.email ? <p><a href={`mailto:${about.email}`}>{about.email}</a></p> : null}
              {about.phone ? <p><a href={`tel:${about.phone.replace(/[^\d+]/g, "")}`}>{about.phone}</a></p> : null}
            </div>
          ) : null}
          <p className="muted">Not sure of your level? <Link to="/assessment">Take the free assessment</Link> first.</p>
        </aside>
        <div>
          {submitted ? <RequestSent request={submitted} onReset={() => setSubmitted(null)} /> : <ContactRequestForm onSubmitted={setSubmitted} />}
        </div>
      </div>
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
  const { me, loading: meLoading } = useMe();
  const createRequest = useCreateRequest();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
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
    if (turnstileSiteKey && !turnstileToken) {
      setFeedback("Please complete the human check.");
      return;
    }

    setSubmitting(true);
    setFeedback("");
    try {
      onSubmitted(await createRequest({ ...request, ...(turnstileToken ? { turnstileToken } : {}) }));
    } catch (err) {
      // Tokens are single-use: get a fresh one for the retry.
      setTurnstileReset((n) => n + 1);
      setFeedback(errorMessage(err, "Could not send your request. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  // Signed in: wait for the profile so the prefilled defaults are final and the form never
  // remounts (which would wipe anything already typed).
  if (isSignedIn && meLoading) return <div className="card contact-form"><p className="muted">Loading your details...</p></div>;
  const formKey = isSignedIn ? `signed-in-${me?.id ?? ""}` : "signed-out";

  return (
    <form id="contact-form" className="card contact-form" onSubmit={handleSubmit} key={formKey}>
      <h3>Tutoring request</h3>
      <div className="grid-2">
        <label>Name<input name="name" defaultValue={defaultName} autoComplete="name" required /></label>
        <label>Email<input name="email" type="email" defaultValue={defaultEmail} autoComplete="email" required /></label>
      </div>
      <div className="grid-2">
        <label>Phone<input name="phone" type="tel" defaultValue={me?.phone ?? ""} autoComplete="tel" /></label>
        <label>Best Way to Contact
          <select name="contactMethod" defaultValue="">
            <option value="">Select...</option>
            {options.contactMethods.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <div className="grid-2">
        <label>Service Type
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
      </div>
      <div className="grid-2">
        <label>Upcoming Exam
          <select name="urgencyWindow" defaultValue="">
            <option value="">No exam / not sure</option>
            {options.urgencyWindows.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>Earliest Start Date<input name="earliestDate" type="date" min={today} /></label>
      </div>
      <label>Topics You Find Hard<input name="hardTopics" placeholder="e.g. integration by parts, projectile motion" /></label>
      <label>Message<textarea name="message" required rows={4} /></label>
      <label className="check-row"><input name="isUrgent" type="checkbox" /> This is urgent</label>
      <label className="check-row"><input name="consultation" type="checkbox" /> I'd like a free consultation first</label>
      {turnstileSiteKey ? <Turnstile onToken={setTurnstileToken} resetKey={turnstileReset} /> : null}
      <button className="primary" type="submit" disabled={submitting}>{submitting ? "Sending..." : "Submit Request"}</button>
      <p className={`feedback ${feedback ? "error" : ""}`} role="alert">{feedback}</p>
    </form>
  );
}
