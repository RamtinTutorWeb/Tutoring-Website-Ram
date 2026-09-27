import { useState, type FormEvent, type ReactNode } from "react";
import { errorMessage } from "../../api/client";
import { useContent } from "../../api/ContentProvider";
import type { Course, SelectableOptionKey, SiteContent } from "../../api/types";
import StarRating from "../../components/StarRating";
import { uid } from "../../lib/id";

// Admin editors for GET/PUT /content. Each save sends only the keys it changed.

export const optionGroupLabels: Record<SelectableOptionKey, string> = {
  contactMethods: "Contact Methods",
  serviceTypes: "Tutoring Service Types",
  urgencyWindows: "Exam Urgency Windows",
  urgencyFlags: "Urgency Choices",
  assessmentSubjects: "Assessment Subjects",
  courseCategories: "Course Categories"
};

export const allOptionGroups = Object.keys(optionGroupLabels) as SelectableOptionKey[];

const EXAM_PREP_CATEGORY = "Exam Prep";

/** A card with an <h3>, or a collapsible admin card when `collapsible`. */
export function Panel({ title, collapsible, children }: { title: string; collapsible?: boolean; children: ReactNode }) {
  if (collapsible) {
    return (
      <details className="card courses-overview admin-management">
        <summary>{title}</summary>
        <div className="admin-management-content">{children}</div>
      </details>
    );
  }
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function useContentSave() {
  const { content, save } = useContent();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", error: false });

  async function run(patch: Partial<SiteContent>, success: string): Promise<boolean> {
    setSaving(true);
    try {
      await save(patch);
      setFeedback({ text: success, error: false });
      return true;
    } catch (err) {
      setFeedback({ text: errorMessage(err, "Could not save changes."), error: true });
      return false;
    } finally {
      setSaving(false);
    }
  }

  const feedbackLine = <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p>;
  return { content, saving, run, setFeedback, feedbackLine };
}

function readCourse(form: HTMLFormElement, category?: string): Omit<Course, "id"> {
  const fd = new FormData(form);
  return {
    title: String(fd.get("title") ?? "").trim(),
    category: category ?? String(fd.get("category") ?? "").trim(),
    description: String(fd.get("description") ?? "").trim()
  };
}

/** Courses and exam tracks share one catalog; the "Exam Prep" category lives in `examPrepTracks`. */
function placeCourse(content: SiteContent, course: Course): Pick<SiteContent, "courses" | "examPrepTracks"> {
  const courses = content.courses.filter((item) => item.id !== course.id);
  const examPrepTracks = content.examPrepTracks.filter((item) => item.id !== course.id);
  if (course.category === EXAM_PREP_CATEGORY) examPrepTracks.push(course);
  else courses.push(course);
  return { courses, examPrepTracks };
}

export function CourseCatalogEditor({ collapsible }: { collapsible?: boolean }) {
  const { content, saving, run, feedbackLine } = useContentSave();
  const categories = content.selectableOptions.courseCategories.filter((category) => category !== "All");
  const allCourses = [...content.courses, ...content.examPrepTracks];

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (await run(placeCourse(content, { id: uid(), ...readCourse(form) }), "Course added.")) form.reset();
  }

  function handleUpdate(e: FormEvent<HTMLFormElement>, course: Course) {
    e.preventDefault();
    void run(placeCourse(content, { id: course.id, ...readCourse(e.currentTarget) }), "Course updated.");
  }

  function handleDelete(courseId: string) {
    void run({
      courses: content.courses.filter((item) => item.id !== courseId),
      examPrepTracks: content.examPrepTracks.filter((item) => item.id !== courseId)
    }, "Course deleted.");
  }

  const categorySelect = (defaultValue?: string) => (
    <select name="category" defaultValue={defaultValue} required>
      {categories.map((category) => <option key={category}>{category}</option>)}
    </select>
  );

  return (
    <Panel title="Manage Courses" collapsible={collapsible}>
      <form onSubmit={handleAdd}>
        <label>Title<input name="title" required /></label>
        <label>Category{categorySelect()}</label>
        <label>Topics/Description<textarea name="description" rows={3} required /></label>
        <button className="primary" type="submit" disabled={saving}>Add Course</button>
      </form>
      <div className="list">
        {allCourses.length ? allCourses.map((course) => (
          <details className="list-item course-detail" key={course.id}>
            <summary><strong>{course.title}</strong> <span className="muted">({course.category})</span></summary>
            <form onSubmit={(e) => handleUpdate(e, course)}>
              <label>Title<input name="title" defaultValue={course.title} required /></label>
              <label>Category{categorySelect(course.category)}</label>
              <label>Topics/Description<textarea name="description" rows={2} defaultValue={course.description} required /></label>
              <div className="row">
                <button type="submit" disabled={saving}>Save</button>
                <button className="danger" type="button" disabled={saving} onClick={() => handleDelete(course.id)}>Delete</button>
              </div>
            </form>
          </details>
        )) : <p className="muted">No courses yet.</p>}
      </div>
      {feedbackLine}
    </Panel>
  );
}

export function ExamTrackEditor({ collapsible }: { collapsible?: boolean }) {
  const { content, saving, run, feedbackLine } = useContentSave();
  const tracks = content.examPrepTracks;

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const track = { id: uid(), ...readCourse(form, EXAM_PREP_CATEGORY) };
    if (await run({ examPrepTracks: [...tracks, track] }, "Exam prep track added.")) form.reset();
  }

  function handleUpdate(e: FormEvent<HTMLFormElement>, track: Course) {
    e.preventDefault();
    const next = { id: track.id, ...readCourse(e.currentTarget, EXAM_PREP_CATEGORY) };
    void run({ examPrepTracks: tracks.map((item) => (item.id === track.id ? next : item)) }, "Exam prep track updated.");
  }

  return (
    <Panel title="Manage Exam Prep Tracks" collapsible={collapsible}>
      <form onSubmit={handleAdd}>
        <label>Track Name<input name="title" placeholder="IB Math AA" required /></label>
        <label>Topics/Description<textarea name="description" rows={3} required /></label>
        <button className="primary" type="submit" disabled={saving}>Add Track</button>
      </form>
      <div className="list">
        {tracks.length ? tracks.map((track) => (
          <form className="list-item" key={track.id} onSubmit={(e) => handleUpdate(e, track)}>
            <label>Track Name<input name="title" defaultValue={track.title} required /></label>
            <label>Topics/Description<textarea name="description" rows={2} defaultValue={track.description} required /></label>
            <div className="row">
              <button type="submit" disabled={saving}>Save</button>
              <button
                className="danger"
                type="button"
                disabled={saving}
                onClick={() => void run({ examPrepTracks: tracks.filter((item) => item.id !== track.id) }, "Exam prep track deleted.")}
              >
                Delete
              </button>
            </div>
          </form>
        )) : <p className="muted">No tracks to edit.</p>}
      </div>
      {feedbackLine}
    </Panel>
  );
}

function cleanOption(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function OptionsEditor({
  title,
  groups,
  collapsible
}: {
  title: string;
  groups: SelectableOptionKey[];
  collapsible?: boolean;
}) {
  const { content, saving, run, setFeedback, feedbackLine } = useContentSave();
  const [group, setGroup] = useState<SelectableOptionKey>(groups[0]);
  const options = content.selectableOptions[group] ?? [];

  function saveOptions(next: string[], success: string) {
    return run({ selectableOptions: { ...content.selectableOptions, [group]: next } }, success);
  }

  function isDuplicate(value: string, exceptIndex = -1): boolean {
    return options.some((item, index) => index !== exceptIndex && item.toLowerCase() === value.toLowerCase());
  }

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const value = cleanOption(String(new FormData(form).get("optionValue") ?? ""));
    if (!value) return;
    if (isDuplicate(value)) {
      setFeedback({ text: "Option already exists.", error: true });
      return;
    }
    if (await saveOptions([...options, value], "Option added.")) form.reset();
  }

  function handleUpdate(e: FormEvent<HTMLFormElement>, index: number) {
    e.preventDefault();
    const value = cleanOption(String(new FormData(e.currentTarget).get("optionValue") ?? ""));
    if (!value) return;
    if (isDuplicate(value, index)) {
      setFeedback({ text: "Option already exists.", error: true });
      return;
    }
    void saveOptions(options.map((item, itemIndex) => (itemIndex === index ? value : item)), "Option updated.");
  }

  return (
    <Panel title={title} collapsible={collapsible}>
      {groups.length > 1 ? (
        <label>Option Group
          <select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value as SelectableOptionKey);
              setFeedback({ text: "", error: false });
            }}
          >
            {groups.map((key) => <option key={key} value={key}>{optionGroupLabels[key]}</option>)}
          </select>
        </label>
      ) : null}
      <form onSubmit={handleAdd}>
        <label>New Option<input name="optionValue" required /></label>
        <button className="primary" type="submit" disabled={saving}>Add Option</button>
      </form>
      <div className="list">
        {options.map((option, index) => (
          <form className="list-item" key={`${group}-${option}-${index}`} onSubmit={(e) => handleUpdate(e, index)}>
            <label>Option Value<input name="optionValue" defaultValue={option} required /></label>
            <div className="row">
              <button type="submit" disabled={saving}>Save</button>
              <button
                className="danger"
                type="button"
                disabled={saving}
                onClick={() => void saveOptions(options.filter((_, itemIndex) => itemIndex !== index), "Option deleted.")}
              >
                Delete
              </button>
            </div>
          </form>
        ))}
      </div>
      {feedbackLine}
    </Panel>
  );
}

export function ReviewsEditor({ collapsible }: { collapsible?: boolean }) {
  const { content, saving, run, feedbackLine } = useContentSave();
  const reviews = content.reviews;

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const review = {
      id: uid(),
      name: String(fd.get("name") ?? "").trim(),
      rating: Math.max(1, Math.min(5, Number(fd.get("rating") ?? 5))),
      text: String(fd.get("text") ?? "").trim(),
      status: "approved" as const
    };
    if (await run({ reviews: [...reviews, review] }, "Review added.")) form.reset();
  }

  return (
    <Panel title="Manage Reviews" collapsible={collapsible}>
      <form onSubmit={handleAdd}>
        <label>Name/Initials<input name="name" required /></label>
        <label>Rating (1-5)<input name="rating" type="number" min={1} max={5} required /></label>
        <label>Review<textarea name="text" rows={2} required /></label>
        <button className="primary" type="submit" disabled={saving}>Add Review</button>
      </form>
      <div className="list">
        {reviews.map((review) => (
          <div className="list-item" key={review.id}>
            <strong>{review.name}</strong> <StarRating rating={Number(review.rating)} />
            <p className="muted">Status: {review.status ?? "approved"}</p>
            <p>{review.text}</p>
            <div className="row">
              {review.status === "pending" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void run({
                    reviews: reviews.map((item) => (item.id === review.id ? { ...item, status: "approved" } : item))
                  }, "Review approved.")}
                >
                  Approve
                </button>
              ) : null}
              <button
                className="danger"
                type="button"
                disabled={saving}
                onClick={() => void run({ reviews: reviews.filter((item) => item.id !== review.id) }, "Review deleted.")}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {feedbackLine}
    </Panel>
  );
}

export function FaqEditor({ collapsible }: { collapsible?: boolean }) {
  const { content, saving, run, feedbackLine } = useContentSave();
  const faq = content.faq;

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const item = {
      id: uid(),
      question: String(fd.get("question") ?? "").trim(),
      answer: String(fd.get("answer") ?? "").trim()
    };
    if (await run({ faq: [...faq, item] }, "FAQ added.")) form.reset();
  }

  function handleUpdate(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = { id, question: String(fd.get("question") ?? "").trim(), answer: String(fd.get("answer") ?? "").trim() };
    void run({ faq: faq.map((item) => (item.id === id ? next : item)) }, "FAQ updated.");
  }

  return (
    <Panel title="Manage FAQ" collapsible={collapsible}>
      <form onSubmit={handleAdd}>
        <label>Question<input name="question" required /></label>
        <label>Answer<textarea name="answer" rows={2} required /></label>
        <button className="primary" type="submit" disabled={saving}>Add FAQ</button>
      </form>
      <div className="list">
        {faq.map((item) => (
          <form className="list-item" key={item.id} onSubmit={(e) => handleUpdate(e, item.id)}>
            <label>Question<input name="question" defaultValue={item.question} required /></label>
            <label>Answer<textarea name="answer" rows={2} defaultValue={item.answer} required /></label>
            <div className="row">
              <button type="submit" disabled={saving}>Save</button>
              <button
                className="danger"
                type="button"
                disabled={saving}
                onClick={() => void run({ faq: faq.filter((entry) => entry.id !== item.id) }, "FAQ deleted.")}
              >
                Delete
              </button>
            </div>
          </form>
        ))}
      </div>
      {feedbackLine}
    </Panel>
  );
}
