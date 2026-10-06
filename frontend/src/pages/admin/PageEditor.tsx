import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../../api/client";
import { useContent } from "../../api/ContentProvider";
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
  type?: "text" | "textarea" | "url" | "email" | "tel";
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
          return (
            <label key={field.name}>
              {field.label}
              {field.hint ? <span className="hint">{field.hint}</span> : null}
              {field.type === "textarea"
                ? <textarea rows={field.rows ?? 4} {...common} />
                : <input type={field.type ?? "text"} {...common} />}
            </label>
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
          <button className="primary" type="submit" disabled={saving || !dirty}>{saving ? "Saving..." : "Save changes"}</button>
          {dirty ? <button type="button" disabled={saving} onClick={() => setDraft(JSON.parse(storedJson) as SitePages[K])}>Discard</button> : null}
          {feedback.text
            ? <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p>
            : dirty ? <span className="muted">Unsaved changes</span> : null}
        </div>
      </form>
    </Panel>
  );
}
