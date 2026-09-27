import { useState } from "react";
import { errorMessage } from "../../api/client";
import type { RequestStatus, SessionRequest } from "../../api/types";
import LoadState from "../../components/LoadState";
import { formatDateTime } from "../../lib/format";
import { requestStatusLabels } from "./labels";

type Filter = "all" | RequestStatus;

/** Admin request inbox: accept (student gets the booking link by email), decline, or close. */
export default function RequestsCard({
  requests,
  loading,
  error,
  onRetry,
  updateStatus,
  defaultFilter = "all",
  collapsible = true
}: {
  requests: SessionRequest[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  updateStatus: (id: string, status: RequestStatus) => Promise<unknown>;
  defaultFilter?: Filter;
  collapsible?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const term = search.trim().toLowerCase();
  const visible = requests.filter((request) => (
    (filter === "all" || request.status === filter) &&
    (!term || request.name.toLowerCase().includes(term) || request.email.toLowerCase().includes(term))
  ));

  async function setStatus(request: SessionRequest, status: RequestStatus) {
    setBusyId(request.id);
    try {
      await updateStatus(request.id, status);
      setFeedback({ text: `${request.name}: ${requestStatusLabels[status].toLowerCase()}.`, error: false });
    } catch (err) {
      setFeedback({ text: errorMessage(err, "Could not update request."), error: true });
    } finally {
      setBusyId("");
    }
  }

  const body = (
    <>
      <div className="request-card-head">
        <label>Status
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All statuses</option>
            {Object.entries(requestStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" /></label>
      </div>
      <LoadState loading={loading} error={error} onRetry={onRetry} />
      {visible.length ? visible.map((request) => {
        const busy = busyId === request.id;
        return (
          <details className="list-item request-detail" key={request.id}>
            <summary>
              <strong>{request.subject || request.serviceType || "General inquiry"}</strong>
              <span className="request-sender">From: {request.name}</span>
              <span className={`request-status status-${request.status}`}>{requestStatusLabels[request.status]}</span>
            </summary>
            <div className="request-body">
              <p>{request.message || "No description provided."}</p>
              {request.serviceType ? <p><strong>Service:</strong> {request.serviceType}</p> : null}
              {request.urgencyWindow ? <p><strong>Exam window:</strong> {request.urgencyWindow}{request.isUrgent ? " (urgent)" : ""}</p> : null}
              {request.earliestDate ? <p><strong>Earliest start:</strong> {request.earliestDate}</p> : null}
              {request.preferredSlot ? <p><strong>Preferred time:</strong> {request.preferredSlot}</p> : null}
              {request.hardTopics ? <p><strong>Topics:</strong> {request.hardTopics}</p> : null}
              <p><strong>Email:</strong> {request.email}</p>
              {request.phone ? <p><strong>Phone:</strong> {request.phone}</p> : null}
              {request.contactMethod ? <p><strong>Preferred contact:</strong> {request.contactMethod}</p> : null}
              {request.consultation ? <p><strong>Wants a free consultation</strong></p> : null}
              <p><strong>Submitted:</strong> {formatDateTime(request.createdAt)}</p>
              <div className="row">
                {request.status === "new" || request.status === "declined" ? (
                  <button className="primary" type="button" disabled={busy} onClick={() => void setStatus(request, "accepted")}>Accept</button>
                ) : null}
                {request.status === "new" ? (
                  <button type="button" disabled={busy} onClick={() => void setStatus(request, "declined")}>Decline</button>
                ) : null}
                {request.status !== "closed" ? (
                  <button type="button" disabled={busy} onClick={() => void setStatus(request, "closed")}>Close</button>
                ) : null}
              </div>
            </div>
          </details>
        );
      }) : !loading ? <p className="muted">No requests match this filter.</p> : null}
      <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p>
    </>
  );

  if (!collapsible) {
    return (
      <div className="card">
        <h3>Request Inbox</h3>
        {body}
      </div>
    );
  }

  return (
    <details className="card courses-overview admin-management" open>
      <summary>Incoming Requests</summary>
      <div className="admin-management-content">{body}</div>
    </details>
  );
}
