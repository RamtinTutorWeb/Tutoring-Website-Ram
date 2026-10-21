import { useMemo, useState, type ReactNode } from "react";
import { errorMessage } from "../api/client";
import type { Course, Resource, ResourceKind } from "../api/types";
import { formatBytes, formatDate } from "../lib/format";
import { videoSource } from "../lib/media";
import VideoPlayer from "./VideoPlayer";

export const resourceKindLabels: Record<ResourceKind, string> = {
  file: "Download",
  link: "Link",
  video: "Video"
};

export const visibilityLabels = {
  public: "Public",
  students: "All students",
  private: "Shared privately"
} as const;

const kindIcons: Record<ResourceKind, string> = { file: "⤓", link: "↗", video: "▶" };

function fileBadge(resource: Resource): string {
  const ext = resource.fileName?.split(".").pop();
  return ext && ext !== resource.fileName ? ext.toUpperCase() : "FILE";
}

/** One resource: files open through a short-lived signed link, videos play inline, links open in a new tab. */
export function ResourceCard({
  resource,
  course,
  onOpen,
  actions
}: {
  resource: Resource;
  course?: Course;
  onOpen: (id: string) => Promise<string>;
  actions?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const embeddable = resource.kind === "video" && resource.url && videoSource(resource.url)?.type !== "link";

  async function open() {
    if (embeddable) {
      setPlaying((value) => !value);
      return;
    }
    // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
    const tab = resource.kind === "file" ? window.open("", "_blank") : null;
    if (tab) tab.opener = null;
    setBusy(true);
    setError("");
    try {
      const url = await onOpen(resource.id);
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (err) {
      tab?.close();
      setError(errorMessage(err, "Could not open this resource."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`resource-card kind-${resource.kind}`}>
      <div className="resource-card-top">
        <span className="resource-icon" aria-hidden="true">{resource.kind === "file" ? fileBadge(resource) : kindIcons[resource.kind]}</span>
        <div className="resource-tags">
          {resource.subject ? <span className="tag">{resource.subject}</span> : null}
          {resource.featured ? <span className="tag tag-accent">Featured</span> : null}
        </div>
      </div>
      <h4>{resource.title}</h4>
      {resource.description ? <p className="resource-desc">{resource.description}</p> : null}
      <p className="resource-meta">
        {resourceKindLabels[resource.kind]}
        {resource.kind === "file" && resource.sizeBytes ? ` · ${formatBytes(resource.sizeBytes)}` : ""}
        {course ? ` · ${course.title}` : ""}
        {` · ${formatDate(resource.createdAt)}`}
      </p>
      {playing && resource.url ? <VideoPlayer url={resource.url} title={resource.title} /> : null}
      <div className="row resource-actions">
        <button className="primary" type="button" onClick={() => void open()} disabled={busy}>
          {busy ? "Opening..." : resource.kind === "file" ? "Download" : resource.kind === "video" ? (playing ? "Hide video" : "Watch") : "Open link"}
        </button>
        {actions}
      </div>
      {error ? <p className="feedback error" role="alert">{error}</p> : null}
    </article>
  );
}

/** Searchable, filterable grid of resources. */
export default function ResourceLibrary({
  resources,
  courses,
  onOpen,
  emptyText,
  renderActions,
  showFilters = true
}: {
  resources: Resource[];
  courses: Course[];
  onOpen: (id: string) => Promise<string>;
  emptyText: ReactNode;
  renderActions?: (resource: Resource) => ReactNode;
  showFilters?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<"" | ResourceKind>("");
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const subjects = useMemo(
    () => [...new Set(resources.map((resource) => resource.subject).filter(Boolean))].sort(),
    [resources]
  );
  const term = search.trim().toLowerCase();
  const visible = resources.filter((resource) => (
    (!subject || resource.subject === subject) &&
    (!kind || resource.kind === kind) &&
    (!term || `${resource.title} ${resource.description}`.toLowerCase().includes(term))
  ));

  return (
    <div className="resource-library">
      {showFilters && resources.length > 3 ? (
        <div className="resource-filters">
          <label>Search<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title or topic" /></label>
          {subjects.length > 1 ? (
            <label>Subject
              <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">All subjects</option>
                {subjects.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          ) : null}
          <label>Type
            <select value={kind} onChange={(e) => setKind(e.target.value as "" | ResourceKind)}>
              <option value="">All types</option>
              {Object.entries(resourceKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
      ) : null}
      {visible.length ? (
        <div className="resource-grid">
          {visible.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              course={resource.courseId ? courseById.get(resource.courseId) : undefined}
              onOpen={onOpen}
              actions={renderActions?.(resource)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">{resources.length ? "Nothing matches these filters." : emptyText}</div>
      )}
    </div>
  );
}
