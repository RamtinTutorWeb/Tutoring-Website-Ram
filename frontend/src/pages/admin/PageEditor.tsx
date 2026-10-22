import { Fragment, useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../../api/client";
import { useContent } from "../../api/ContentProvider";
import { useUploadMedia } from "../../api/hooks";
import type { PageKey, SitePages, TextSection } from "../../api/types";
import { uid } from "../../lib/id";
import { Panel } from "./editors";

/** String fields of a page (everything except `sections`). */
type TextField<K extends PageKey> = {
  [F in keyof SitePages[K]]: SitePages[K][F] extends string ? F : never;
}[keyof SitePages[K]] & string;

export interface FieldSpec<K extends PageKey> {
  name: TextField<K>;
  label: string;
  /** "image": a URL field plus an upload button (public site-media bucket). */
  type?: "text" | "textarea" | "url" | "email" | "tel" | "image";
  rows?: number;
  hint?: string;
  placeholder?: string;
}

/**
 * Edits one page of `pages` and saves it with `PUT /content` ({ pages: { [page]: draft } }).
 * Pages with `sections` (About, Policy) get an add / reorder / remove list of heading + text blocks.
 */
export function PageEditor<K extends PageKey>({
  page,
  title,
  description,
  fields,
  sectionsLabel
}: {
  page: K;
  title: string;
  description?: string;
  fields: FieldSpec<K>[];
  /** Set to show the sections list (the page type must have `sections`). */
  sectionsLabel?: string;
}) {
  const { content, save } = useContent();
  const stored = content.pages[page];
  const [draft, setDraft] = useState<SitePages[K]>(stored);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const uploadMedia = useUploadMedia();
  const [uploading, setUploading] = useState(false);

  // Reset the draft whenever the saved version changes (initial load, after save, another tab).
  const storedJson = JSON.stringify(stored);
  useEffect(() => setDraft(JSON.parse(storedJson) as SitePages[K]), [storedJson]);

  const dirty = JSON.stringify(draft) !== storedJson;
  const record = draft as unknown as Record<string, unknown>;
  const sections = (record.sections as TextSection[] | undefined) ?? [];

  function setField(name: string, value: unknown) {
    setDraft((current) => ({ ...current, [name]: value }));
    setFeedback({ text: "", error: false });
  }

  function setSections(next: TextSection[]) {
    setField("sections", next);
  }

  function updateSection(id: string, change: Partial<TextSection>) {
    setSections(sections.map((section) => (section.id === id ? { ...section, ...change } : section)));
  }

  function moveSection(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
  }

  async function handleUpload(name: string, file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ text: "Images must be 5 MB or smaller.", error: true });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadMedia(file);
      setField(name, url);
      setFeedback({ text: "Image uploaded. Save changes to publish it.", error: false });
    } catch (err) {
      setFeedback({ text: errorMessage(err, "Could not upload the image."), error: true });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ pages: { [page]: draft } as Partial<SitePages> });
      setFeedback({ text: "Saved. The live site is updated.", error: false });
    } catch (err) {
      setFeedback({ text: errorMessage(err, "Could not save changes."), error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={title} description={description}>
      <form onSubmit={handleSubmit}>
        {fields.map((field) => {
          const value = String(record[field.name] ?? "");
          const common = {
            name: field.name,
            value,
            placeholder: field.placeholder,
            onChange: (e: { target: { value: string } }) => setField(field.name, e.target.value)
          };
          const input = (
            <label>
              {field.label}
              {field.hint ? <span className="hint">{field.hint}</span> : null}
              {field.type === "textarea"
                ? <textarea rows={field.rows ?? 4} {...common} />
                : <input type={field.type === "image" ? "url" : field.type ?? "text"} {...common} />}
            </label>
          );
          if (field.type !== "image") return <Fragment key={field.name}>{input}</Fragment>;
          return (
            <Fragment key={field.name}>
              {input}
              <div className="image-field">
                {value ? <img src={value} alt="" className="image-field-preview" /> : null}
                <label className="file-button">
                  {uploading ? "Uploading..." : value ? "Replace image" : "Upload image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                    aria-label={`Upload ${field.label.toLowerCase()}`}
                    disabled={uploading}
                    onChange={(e) => {
                      void handleUpload(field.name, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {value ? <button type="button" className="small" onClick={() => setField(field.name, "")}>Remove</button> : null}
              </div>
            </Fragment>
          );
        })}

        {sectionsLabel ? (
          <>
            <h4 style={{ marginTop: "1.25rem" }}>{sectionsLabel}</h4>
            {sections.map((section, index) => (
              <div className="section-editor" key={section.id}>
                <label>Heading
                  <input value={section.heading} onChange={(e) => updateSection(section.id, { heading: e.target.value })} required />
                </label>
                <label>Text
                  <span className="hint">Leave a blank line between paragraphs.</span>
                  <textarea rows={5} value={section.body} onChange={(e) => updateSection(section.id, { body: e.target.value })} />
                </label>
                <div className="row" style={{ marginTop: "0.6rem" }}>
                  <button type="button" className="small" disabled={index === 0} onClick={() => moveSection(index, -1)}>Move up</button>
                  <button type="button" className="small" disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}>Move down</button>
                  <button
                    type="button"
                    className="small danger"
                    onClick={() => setSections(sections.filter((item) => item.id !== section.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setSections([...sections, { id: uid(), heading: "New section", body: "" }])}>
              + Add section
            </button>
          </>
        ) : null}

        <div className="save-bar">
          <button className="primary" type="submit" disabled={saving || uploading || !dirty}>{saving ? "Saving..." : "Save changes"}</button>
          {dirty ? <button type="button" disabled={saving} onClick={() => setDraft(JSON.parse(storedJson) as SitePages[K])}>Discard</button> : null}
          {feedback.text
            ? <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p>
            : dirty ? <span className="muted">Unsaved changes</span> : null}
        </div>
      </form>
    </Panel>
  );
}
