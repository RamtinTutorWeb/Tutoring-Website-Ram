import { useState, type FormEvent } from "react";
import { errorMessage } from "../api/client";
import { useContent } from "../api/ContentProvider";
import { useAdminUsers, useResources } from "../api/hooks";
import type { Course, Profile, Resource, ResourceInput, ResourceKind, ResourceVisibility, UploadedFile } from "../api/types";
import { formatBytes } from "../lib/format";
import LoadState from "./LoadState";
import ResourceLibrary, { resourceKindLabels, visibilityLabels } from "./ResourceLibrary";

/** Matches the backend's MAX_FILE_BYTES and the storage bucket limit. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const visibilityHelp: Record<ResourceVisibility, string> = {
  public: "Anyone can see it on the Resources page: good for free samples that advertise your teaching.",
  students: "Any signed-in student can see it.",
  private: "Only the students you pick. They get an email when it's shared."
};

interface Draft {
  kind: ResourceKind;
  title: string;
  description: string;
  url: string;
  subject: string;
  courseId: string;
  visibility: ResourceVisibility;
  studentIds: string[];
  featured: boolean;
}

const emptyDraft: Draft = {
  kind: "file",
  title: "",
  description: "",
  url: "",
  subject: "",
  courseId: "",
  visibility: "students",
  studentIds: [],
  featured: false
};

function draftOf(resource: Resource): Draft {
  return {
    kind: resource.kind,
    title: resource.title,
    description: resource.description,
    url: resource.url ?? "",
    subject: resource.subject,
    courseId: resource.courseId ?? "",
    visibility: resource.visibility,
    studentIds: resource.studentIds,
    featured: resource.featured
  };
}

/** Admin: upload files, add links/videos, choose who sees them; edit and delete existing ones. */
export default function ResourceManager() {
  const { content } = useContent();
  const resources = useResources();
  const users = useAdminUsers(true);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [deletingId, setDeletingId] = useState("");
  const [listFeedback, setListFeedback] = useState({ text: "", error: false });
  const catalog = [...content.courses, ...content.examPrepTracks];
  const students = (users.data ?? []).filter((user) => user.role === "student");

  function done(text: string) {
    setEditing(null);
    setFormKey((key) => key + 1);
    setListFeedback({ text, error: false });
  }

  async function handleDelete(resource: Resource) {
    if (!window.confirm(`Delete "${resource.title}"? Students will lose access.`)) return;
    setDeletingId(resource.id);
    try {
      await resources.remove(resource.id);
      if (editing?.id === resource.id) done("Resource deleted.");
      else setListFeedback({ text: "Resource deleted.", error: false });
    } catch (err) {
      setListFeedback({ text: errorMessage(err, "Could not delete this resource."), error: true });
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="dashboard-stack" id="resource-manager">
      <ResourceForm
        key={editing ? `edit-${editing.id}` : `new-${formKey}`}
        editing={editing}
        students={students}
        studentsLoading={users.loading}
        subjects={content.selectableOptions.assessmentSubjects}
        courses={catalog}
        onCancel={() => setEditing(null)}
        onSaved={(text) => done(text)}
        create={resources.create}
        update={resources.update}
        upload={resources.upload}
      />

      <div className="card">
        <div className="request-card-head">
          <h3>All resources ({resources.data?.length ?? 0})</h3>
        </div>
        <LoadState loading={resources.loading} error={resources.error} onRetry={() => void resources.refetch()} />
        {resources.data ? (
          <ResourceLibrary
            resources={resources.data}
            courses={catalog}
            onOpen={resources.open}
            emptyText="No resources yet. Upload your first worksheet or add a link above."
            renderActions={(resource) => (
              <>
                <span className={`visibility-pill vis-${resource.visibility}`}>
                  {visibilityLabels[resource.visibility]}
                  {resource.visibility === "private" ? ` (${resource.studentIds.length})` : ""}
                </span>
                <button type="button" onClick={() => { setEditing(resource); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                <button className="danger" type="button" disabled={deletingId === resource.id} onClick={() => void handleDelete(resource)}>Delete</button>
              </>
            )}
          />
        ) : null}
        <p className={`feedback ${listFeedback.error ? "error" : "ok"}`} role="status">{listFeedback.text}</p>
      </div>
    </div>
  );
}

function ResourceForm({
  editing,
  students,
  studentsLoading,
  subjects,
  courses,
  onCancel,
  onSaved,
  create,
  update,
  upload
}: {
  editing: Resource | null;
  students: Profile[];
  studentsLoading: boolean;
  subjects: string[];
  courses: Course[];
  onCancel: () => void;
  onSaved: (text: string) => void;
  create: (input: ResourceInput) => Promise<Resource>;
  update: (id: string, patch: Partial<ResourceInput>) => Promise<Resource>;
  upload: (file: File) => Promise<UploadedFile>;
}) {
  const [draft, setDraft] = useState<Draft>(editing ? draftOf(editing) : emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [studentFilter, setStudentFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const keepsExistingFile = Boolean(editing && editing.kind === "file" && draft.kind === "file" && !file);
  const term = studentFilter.trim().toLowerCase();
  const visibleStudents = students.filter((student) => (
    !term || `${student.fullName ?? ""} ${student.email}`.toLowerCase().includes(term) || draft.studentIds.includes(student.id)
  ));

  function toggleStudent(id: string) {
    set("studentIds", draft.studentIds.includes(id) ? draft.studentIds.filter((x) => x !== id) : [...draft.studentIds, id]);
  }

  function pickFile(next: File | null) {
    if (next && next.size > MAX_FILE_BYTES) {
      setFeedback({ text: `That file is ${formatBytes(next.size)}; the limit is ${formatBytes(MAX_FILE_BYTES)}.`, error: true });
      setFile(null);
      return;
    }
    setFeedback({ text: "", error: false });
    setFile(next);
    // Name the resource after the file unless a title was typed.
    if (next && !draft.title.trim()) set("title", next.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (draft.kind === "file" && !file && !keepsExistingFile) {
      setFeedback({ text: "Choose a file to upload.", error: true });
      return;
    }
    if (draft.visibility === "private" && !draft.studentIds.length) {
      setFeedback({ text: "Pick at least one student, or change who can see it.", error: true });
      return;
    }
    setSaving(true);
    try {
      let body: Partial<ResourceInput> = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        kind: draft.kind,
        subject: draft.subject,
        courseId: draft.courseId || null,
        visibility: draft.visibility,
        studentIds: draft.visibility === "private" ? draft.studentIds : [],
        featured: draft.visibility === "public" && draft.featured
      };
      if (draft.kind === "file") {
        if (file) {
          setFeedback({ text: `Uploading ${file.name}...`, error: false });
          body = { ...body, ...(await upload(file)) };
        }
      } else {
        body.url = draft.url.trim();
      }
      if (editing) await update(editing.id, body);
      else await create(body as ResourceInput);
      onSaved(editing ? "Resource updated." : "Resource published.");
    } catch (err) {
      setFeedback({ text: errorMessage(err, "Could not save this resource."), error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card resource-form" onSubmit={handleSubmit}>
      <div className="request-card-head">
        <h3>{editing ? `Edit: ${editing.title}` : "Add a resource"}</h3>
        {editing ? <button type="button" onClick={onCancel}>Cancel edit</button> : null}
      </div>

      <div className="segmented" role="radiogroup" aria-label="Resource type">
        {(Object.keys(resourceKindLabels) as ResourceKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={draft.kind === kind}
            className={draft.kind === kind ? "active" : ""}
            onClick={() => set("kind", kind)}
          >
            {kind === "file" ? "Upload file" : kind === "link" ? "Web link" : "Video"}
          </button>
        ))}
      </div>

      {draft.kind === "file" ? (
        <label className="dropzone">
          <input type="file" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          <span className="dropzone-title">{file ? file.name : keepsExistingFile ? `Current file: ${editing?.fileName}` : "Choose a file"}</span>
          <span className="muted">
            {file ? formatBytes(file.size) : keepsExistingFile ? "Pick a new file to replace it." : "PDF, slides, worksheets, images... up to 50 MB"}
          </span>
        </label>
      ) : (
        <label>{draft.kind === "video" ? "Video URL (YouTube, Vimeo or a video file)" : "URL"}
          <input type="url" value={draft.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" required />
        </label>
      )}

      <div className="grid-2">
        <label>Title<input value={draft.title} onChange={(e) => set("title", e.target.value)} required maxLength={200} /></label>
        <label>Subject
          <select value={draft.subject} onChange={(e) => set("subject", e.target.value)}>
            <option value="">No subject</option>
            {subjects.map((subject) => <option key={subject}>{subject}</option>)}
          </select>
        </label>
      </div>
      <label>Description<textarea rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} placeholder="What it covers and when to use it" /></label>
      <label>Course (optional)
        <select value={draft.courseId} onChange={(e) => set("courseId", e.target.value)}>
          <option value="">Not tied to a course</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title} ({course.category})</option>)}
        </select>
      </label>

      <fieldset className="visibility-field">
        <legend>Who can see it</legend>
        <div className="segmented">
          {(Object.keys(visibilityLabels) as ResourceVisibility[]).map((value) => (
            <button
              key={value}
              type="button"
              className={draft.visibility === value ? "active" : ""}
              aria-pressed={draft.visibility === value}
              onClick={() => set("visibility", value)}
            >
              {visibilityLabels[value]}
            </button>
          ))}
        </div>
        <p className="muted">{visibilityHelp[draft.visibility]}</p>
        {draft.visibility === "private" ? (
          <div className="student-picker">
            <input type="search" placeholder="Find a student" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} />
            <div className="student-picker-list">
              {studentsLoading ? <p className="muted">Loading students...</p> : null}
              {!studentsLoading && !students.length ? <p className="muted">No student accounts yet.</p> : null}
              {visibleStudents.map((student) => (
                <label className="check-row" key={student.id}>
                  <input type="checkbox" checked={draft.studentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} />
                  {student.fullName || student.email} <span className="muted">{student.fullName ? student.email : ""}</span>
                </label>
              ))}
            </div>
            <p className="muted">{draft.studentIds.length} selected</p>
          </div>
        ) : null}
      </fieldset>

      {draft.visibility === "public" ? (
        <label className="check-row">
          <input type="checkbox" checked={draft.featured} onChange={(e) => set("featured", e.target.checked)} /> Feature on the home page
        </label>
      ) : null}

      <button className="primary" type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Publish resource"}</button>
      <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p>
    </form>
  );
}
