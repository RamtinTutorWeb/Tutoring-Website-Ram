import { FormEvent, useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import type { BookingRequest, SelectableOptionKey } from "../types";

const contactOptionGroups: Array<{ key: SelectableOptionKey; label: string }> = [
  { key: "contactMethods", label: "Contact Methods" }
];

type RequestStatusFilter = "new" | "replied";

export default function ContactPage() {
  const {
    db,
    currentUser,
    submitContact,
    updateRequestStatus,
    addSelectableOption,
    updateSelectableOption,
    deleteSelectableOption
  } = useAppContext();
  const [feedback, setFeedback] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>("new");
  const [requestSearch, setRequestSearch] = useState("");
  const [selectedOptionGroup, setSelectedOptionGroup] = useState<SelectableOptionKey>("contactMethods");
  const isAdmin = currentUser?.role === "admin";
  const contactRequests = useMemo(
    () => db.requests.filter((request) => request.serviceType !== "Session Request"),
    [db.requests]
  );

  const filteredRequests = useMemo(() => {
    const requests = [...contactRequests].reverse();
    return requests.filter((request) => (
      request.status === statusFilter &&
      request.name.toLowerCase().includes(requestSearch.trim().toLowerCase())
    ));
  }, [contactRequests, requestSearch, statusFilter]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = submitContact({
      name: String(fd.get("name") ?? ""),
      contactMethod: String(fd.get("contactMethod") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      serviceType: "General Inquiry",
      subject: "Contact message",
      urgencyWindow: "",
      isUrgent: "No",
      hardTopics: "",
      preferredSlot: "",
      earliestDate: "",
      message: String(fd.get("message") ?? ""),
      consultation: false
    });

    setFeedback(result.message);
    if (result.ok) e.currentTarget.reset();
  }

  async function handleAddOption(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) return;
    const fd = new FormData(e.currentTarget);
    const result = await addSelectableOption(selectedOptionGroup, String(fd.get("optionValue") ?? ""));
    setFeedback(result.message);
    if (result.ok) e.currentTarget.reset();
  }

  async function handleUpdateOption(e: FormEvent<HTMLFormElement>, index: number) {
    e.preventDefault();
    if (!isAdmin) return;
    const fd = new FormData(e.currentTarget);
    const result = await updateSelectableOption(selectedOptionGroup, index, String(fd.get("optionValue") ?? ""));
    setFeedback(result.message);
  }

  if (isAdmin) {
    return (
      <section data-page="contact" className="page">
        <h2>Contact Operations</h2>
        <p className="muted">Review general contact messages and manage contact-method choices.</p>

        <div className="grid-2">
          <StatCard label="New" value={contactRequests.filter((request) => request.status === "new").length} />
          <StatCard label="Responded" value={contactRequests.filter((request) => request.status === "replied").length} />
        </div>

        <div className="grid-2">
          <RequestsPanel
            requests={filteredRequests}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            requestSearch={requestSearch}
            setRequestSearch={setRequestSearch}
            updateRequestStatus={updateRequestStatus}
            showContactDetails
          />

          <div className="card">
            <h3>Manage Contact Form Choices</h3>
            <label>Field Group
              <select
                value={selectedOptionGroup}
                onChange={(e) => {
                  setSelectedOptionGroup(e.target.value as SelectableOptionKey);
                  setFeedback("");
                }}
              >
                {contactOptionGroups.map((group) => (
                  <option key={group.key} value={group.key}>{group.label}</option>
                ))}
              </select>
            </label>
            <form onSubmit={handleAddOption}>
              <label>New Value<input name="optionValue" required /></label>
              <button className="primary" type="submit">Add Value</button>
            </form>
            <div className="list">
              {db.selectableOptions[selectedOptionGroup].map((option, index) => (
                <form className="list-item" key={`${selectedOptionGroup}-${option}-${index}`} onSubmit={(e) => handleUpdateOption(e, index)}>
                  <label>Value<input name="optionValue" defaultValue={option} required /></label>
                  <div className="row">
                    <button type="submit">Save</button>
                    <button
                      className="danger"
                      type="button"
                      onClick={async () => {
                        const result = await deleteSelectableOption(selectedOptionGroup, index);
                        setFeedback(result.ok ? "Value deleted." : result.message);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </form>
              ))}
            </div>
            <p className="feedback">{feedback}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-page="contact" className="page">
      <h2>Contact</h2>
      <p className="muted">Send us a general question or message. To reserve tutoring time, use Book a Session in your dashboard.</p>
      <ContactRequestForm db={db} feedback={feedback} handleSubmit={handleSubmit} />
    </section>
  );
}

function ContactRequestForm({
  db,
  feedback,
  handleSubmit
}: {
  db: ReturnType<typeof useAppContext>["db"];
  feedback: string;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form id="contact-form" className="card" onSubmit={handleSubmit}>
      <label>Name<input name="name" required /></label>
      <label>Best Way to Contact
        <select name="contactMethod" required>
          <option value="">Select...</option>
          {db.selectableOptions.contactMethods.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Phone<input name="phone" /></label>
      <label>Message<textarea name="message" required rows={4} /></label>
      <label className="check-row"><input name="notRobot" type="checkbox" required /> I'm not a robot</label>
      <button className="primary" type="submit">Submit Request</button>
      <p className="feedback">{feedback}</p>
    </form>
  );
}

function RequestsPanel({
  requests,
  statusFilter,
  setStatusFilter,
  requestSearch,
  setRequestSearch,
  updateRequestStatus,
  showContactDetails
}: {
  requests: BookingRequest[];
  statusFilter: RequestStatusFilter;
  setStatusFilter: (status: RequestStatusFilter) => void;
  requestSearch: string;
  setRequestSearch: (value: string) => void;
  updateRequestStatus: (requestId: string, status: "replied" | "closed") => void;
  showContactDetails?: boolean;
}) {
  return (
    <div className="card">
      <h3>Request Inbox</h3>
      <div className="filters">
      <label>Status Filter
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RequestStatusFilter)}>
          <option value="new">New</option>
          <option value="replied">Responded</option>
        </select>
      </label>
      <label>Search By Name<input value={requestSearch} onChange={(e) => setRequestSearch(e.target.value)} placeholder="Student name" /></label>
      </div>

      <div className="list">
        {requests.length ? requests.map((request) => (
          <div className="list-item" key={request.id}>
            <p><strong>{request.name}</strong> | {request.serviceType} | {request.status}</p>
            {showContactDetails ? (
              <p className="muted">{request.email} {request.phone ? `| ${request.phone}` : ""} | {request.contactMethod}</p>
            ) : null}
            <p><strong>Subject:</strong> {request.subject || "Not specified"}</p>
            <p>{request.message}</p>
            <div className="row">
              <button type="button" onClick={() => updateRequestStatus(request.id, "replied")}>Mark Responded</button>
            </div>
          </div>
        )) : (
          <p className="muted">No requests match this filter.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
