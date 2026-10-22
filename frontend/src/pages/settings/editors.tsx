import { useState, type FormEvent, type ReactNode } from "react";
import { errorMessage } from "../../api/client";
import { useContent, type ContentPatch } from "../../api/ContentProvider";
import { useCreateReview, useReviewAdmin, useUploadMedia } from "../../api/hooks";
import type { About, AboutStat, AssessmentQuestion, Course, Review, SelectableOptionKey, SiteContent } from "../../api/types";
import StarRating from "../../components/StarRating";
import { uid } from "../../lib/id";

// Admin editors for GET/PUT /content (each save sends only the keys it changed) and /reviews.

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

  async function run(patch: ContentPatch, success: string): Promise<boolean> {
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
function placeCourse(content: SiteContent, course: Course): Pick<ContentPatch, "courses" | "examPrepTracks"> {
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

/** Reviews live in their own table: POST /reviews (admin -> approved), PATCH/DELETE /reviews/:id. */
export function ReviewsEditor({ collapsible }: { collapsible?: boolean }) {
  const { content, update } = useContent();
  const createReview = useCreateReview();
  const reviewAdmin = useReviewAdmin();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const reviews = content.reviews;

  async function perform(action: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      setFeedback({ text: success, error: false });
      return true;
    } catch (err) {
      setFeedback({ text: errorMessage(err, "Could not save the review."), error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function readReview(form: HTMLFormElement): Pick<Review, "name" | "rating" | "text"> {
    const fd = new FormData(form);
    return {
      name: String(fd.get("name") ?? "").trim(),
      rating: Math.max(1, Math.min(5, Number(fd.get("rating") ?? 5))),
      text: String(fd.get("text") ?? "").trim()
    };
  }

  function replaceReview(next: Review) {
    update((current) => ({ ...current, reviews: current.reviews.map((item) => (item.id === next.id ? next : item)) }));
  }

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = readReview(form);
    const ok = await perform(async () => {
      const created = await createReview(fields);
      update((current) => ({ ...current, reviews: [...current.reviews, created] }));
    }, "Review added.");
    if (ok) form.reset();
  }

  function handleEdit(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fields = readReview(e.currentTarget);
    void perform(async () => replaceReview(await reviewAdmin.update(id, fields)), "Review updated.");
  }

  function handleApprove(id: string) {
    void perform(async () => replaceReview(await reviewAdmin.update(id, { status: "approved" })), "Review approved.");
  }

  function handleDelete(id: string) {
    void perform(async () => {
      await reviewAdmin.remove(id);
      update((current) => ({ ...current, reviews: current.reviews.filter((item) => item.id !== id) }));
    }, "Review deleted.");
  }

  const pendingCount = reviews.filter((review) => review.status === "pending").length;

  return (
    <Panel title={pendingCount ? `Manage Reviews (${pendingCount} pending)` : "Manage Reviews"} collapsible={collapsible}>
      <form onSubmit={handleAdd}>
        <label>Name/Initials<input name="name" required /></label>
        <label>Rating (1-5)<input name="rating" type="number" min={1} max={5} required /></label>
        <label>Review<textarea name="text" rows={2} required /></label>
        <button className="primary" type="submit" disabled={busy}>Add Review</button>
      </form>
      <div className="list">
        {reviews.map((review) => (
          <details className="list-item course-detail" key={review.id}>
            <summary>
              <strong>{review.name}</strong> <StarRating rating={Number(review.rating)} />{" "}
              <span className={`request-status status-${review.status === "pending" ? "new" : "accepted"}`}>{review.status ?? "approved"}</span>
            </summary>
            <p>{review.text}</p>
            <form onSubmit={(e) => handleEdit(e, review.id)}>
              <label>Name/Initials<input name="name" defaultValue={review.name} required /></label>
              <label>Rating (1-5)<input name="rating" type="number" min={1} max={5} defaultValue={review.rating} required /></label>
              <label>Review<textarea name="text" rows={2} defaultValue={review.text} required /></label>
              <div className="row">
                <button type="submit" disabled={busy}>Save</button>
                {review.status === "pending" ? (
                  <button className="primary" type="button" disabled={busy} onClick={() => handleApprove(review.id)}>Approve</button>
                ) : null}
                <button className="danger" type="button" disabled={busy} onClick={() => handleDelete(review.id)}>Delete</button>
              </div>
            </form>
          </details>
        ))}
      </div>
      <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p>
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

/** The public profile behind the home page: hero copy, bio, contact details, numbers and video. */
export function TutorProfileEditor({ collapsible }: { collapsible?: boolean }) {
  const { content, saving, run, setFeedback, feedbackLine } = useContentSave();
  const uploadMedia = useUploadMedia();
  const [uploading, setUploading] = useState(false);
  const [about, setAbout] = useState<About>(content.about);
  const set = <K extends keyof About>(key: K, value: About[K]) => setAbout((current) => ({ ...current, [key]: value }));
  const setStat = (id: string, patch: Partial<AboutStat>) =>
    set("stats", about.stats.map((stat) => (stat.id === id ? { ...stat, ...patch } : stat)));

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ text: "Photos must be 5 MB or smaller.", error: true });
      return;
    }
    setUploading(true);
    try {
      set("photoUrl", await uploadMedia(file));
      setFeedback({ text: "Photo uploaded. Save Profile to publish it.", error: false });
    } catch (err) {
      setFeedback({ text: errorMessage(err, "Could not upload the photo."), error: true });
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void run({
      about: {
        ...about,
        stats: about.stats.filter((stat) => stat.value.trim() || stat.label.trim()),
        highlights: about.highlights.map((line) => line.trim()).filter(Boolean)
      }
    }, "Tutor profile saved. The home page is updated.");
  }

  return (
    <Panel title="Tutor Profile (home page)" collapsible={collapsible}>
      <form onSubmit={handleSubmit} className="profile-editor">
        <div className="grid-2">
          <label>Your name<input value={about.tutorName} onChange={(e) => set("tutorName", e.target.value)} maxLength={120} /></label>
          <label>Location<input value={about.location} onChange={(e) => set("location", e.target.value)} placeholder="Online & in person, Toronto" maxLength={200} /></label>
        </div>
        <label>Headline<input value={about.headline} onChange={(e) => set("headline", e.target.value)} maxLength={200} required /></label>
        <label>Tagline<textarea rows={2} value={about.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={600} /></label>
        <label>About you<textarea rows={5} value={about.bio} onChange={(e) => set("bio", e.target.value)} maxLength={5000} /></label>
        <div className="grid-2">
          <label>Public email<input type="email" value={about.email} onChange={(e) => set("email", e.target.value)} placeholder="you@domain.com" /></label>
          <label>Public phone<input type="tel" value={about.phone} onChange={(e) => set("phone", e.target.value)} maxLength={60} /></label>
        </div>
        <div className="photo-field">
          {about.photoUrl ? <img className="photo-preview" src={about.photoUrl} alt="Current profile photo" /> : <div className="photo-preview empty" aria-hidden="true">No photo</div>}
          <div>
            <label className="button-link upload-button">
              {uploading ? "Uploading..." : about.photoUrl ? "Replace photo" : "Upload photo"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" disabled={uploading} onChange={(e) => void handlePhoto(e.target.files?.[0])} />
            </label>
            {about.photoUrl ? <button type="button" className="danger" onClick={() => set("photoUrl", "")}>Remove</button> : null}
            <label>Or paste an image URL<input type="url" value={about.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} placeholder="https://..." /></label>
          </div>
        </div>
        <label>Intro video URL<input type="url" value={about.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="YouTube, Vimeo or .mp4 link" /></label>

        <fieldset>
          <legend>Headline numbers</legend>
          {about.stats.map((stat) => (
            <div className="stat-edit-row" key={stat.id}>
              <input aria-label="Value" value={stat.value} onChange={(e) => setStat(stat.id, { value: e.target.value })} placeholder="300+" maxLength={40} />
              <input aria-label="Label" value={stat.label} onChange={(e) => setStat(stat.id, { label: e.target.value })} placeholder="Students tutored" maxLength={80} />
              <button type="button" className="danger" onClick={() => set("stats", about.stats.filter((item) => item.id !== stat.id))}>Remove</button>
            </div>
          ))}
          {about.stats.length < 8 ? (
            <button type="button" onClick={() => set("stats", [...about.stats, { id: uid(), value: "", label: "" }])}>Add number</button>
          ) : null}
        </fieldset>

        <label>Highlights (one per line)
          <textarea
            rows={4}
            value={about.highlights.join("\n")}
            onChange={(e) => set("highlights", e.target.value.split("\n").slice(0, 12))}
            placeholder={"Free 15-minute consultation\nFormer IB examiner"}
          />
        </label>
        <button className="primary" type="submit" disabled={saving || uploading}>{saving ? "Saving..." : "Save Profile"}</button>
      </form>
      {feedbackLine}
    </Panel>
  );
}

const blankQuestion = (): AssessmentQuestion => ({ id: uid(), text: "", options: ["", ""], correctIndex: 0, topic: "" });

/** The placement test on /assessment: questions, options, the right answer, and the topic a miss recommends. */
export function AssessmentEditor({ collapsible }: { collapsible?: boolean }) {
  const { content, saving, run, setFeedback, feedbackLine } = useContentSave();
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(content.assessmentQuestions);
  const edit = (id: string, patch: Partial<AssessmentQuestion>) =>
    setQuestions((current) => current.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  function setOption(q: AssessmentQuestion, index: number, value: string) {
    edit(q.id, { options: q.options.map((o, i) => (i === index ? value : o)) });
  }

  function removeOption(q: AssessmentQuestion, index: number) {
    const options = q.options.filter((_, i) => i !== index);
    const correctIndex = q.correctIndex === index ? 0 : q.correctIndex > index ? q.correctIndex - 1 : q.correctIndex;
    edit(q.id, { options, correctIndex });
  }

  function move(index: number, delta: number) {
    setQuestions((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, item!);
      return next;
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleaned = questions.map((q) => {
      const kept = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      const correct = kept.findIndex((x) => x.i === q.correctIndex);
      return { ...q, text: q.text.trim(), topic: q.topic.trim(), options: kept.map((x) => x.o), correctIndex: correct };
    });
    const broken = cleaned.findIndex((q) => !q.text || q.options.length < 2 || q.correctIndex < 0);
    if (broken >= 0) {
      setFeedback({ text: `Question ${broken + 1} needs text, at least two options, and a correct answer that isn't blank.`, error: true });
      return;
    }
    void run({ assessmentQuestions: cleaned }, "Assessment saved.").then((ok) => { if (ok) setQuestions(cleaned); });
  }

  return (
    <Panel title={`Placement Assessment (${questions.length} questions)`} collapsible={collapsible}>
      <p className="muted">Students see these on the Assessment page. A missed question recommends its topic as the place to start.</p>
      <form onSubmit={handleSubmit}>
        <div className="list">
          {questions.map((q, qi) => (
            <fieldset className="list-item question-edit" key={q.id}>
              <legend>Question {qi + 1}</legend>
              <label>Question<input value={q.text} onChange={(e) => edit(q.id, { text: e.target.value })} maxLength={1000} required /></label>
              <div className="option-edit-list" role="radiogroup" aria-label={`Correct answer for question ${qi + 1}`}>
                {q.options.map((option, oi) => (
                  <div className="option-edit" key={oi}>
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      aria-label={`Option ${oi + 1} is correct`}
                      checked={q.correctIndex === oi}
                      onChange={() => edit(q.id, { correctIndex: oi })}
                    />
                    <input aria-label={`Option ${oi + 1}`} value={option} onChange={(e) => setOption(q, oi, e.target.value)} maxLength={300} placeholder={`Option ${oi + 1}`} />
                    {q.options.length > 2 ? <button type="button" className="danger" onClick={() => removeOption(q, oi)} aria-label={`Remove option ${oi + 1}`}>✕</button> : null}
                  </div>
                ))}
              </div>
              <p className="muted">Select the radio button next to the correct answer.</p>
              <label>Topic to recommend when missed<input value={q.topic} onChange={(e) => edit(q.id, { topic: e.target.value })} maxLength={200} placeholder="e.g. Kinematics" /></label>
              <div className="row">
                {q.options.length < 8 ? <button type="button" onClick={() => edit(q.id, { options: [...q.options, ""] })}>Add option</button> : null}
                <button type="button" disabled={qi === 0} onClick={() => move(qi, -1)}>Move up</button>
                <button type="button" disabled={qi === questions.length - 1} onClick={() => move(qi, 1)}>Move down</button>
                <button type="button" className="danger" onClick={() => setQuestions((current) => current.filter((x) => x.id !== q.id))}>Delete question</button>
              </div>
            </fieldset>
          ))}
        </div>
        <div className="row">
          {questions.length < 50 ? <button type="button" onClick={() => setQuestions((current) => [...current, blankQuestion()])}>Add question</button> : null}
          <button className="primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Assessment"}</button>
        </div>
      </form>
      {feedbackLine}
    </Panel>
  );
}

/** Sections of the public /policy page (cancellations, payments, privacy...). */
export function PolicyEditor({ collapsible }: { collapsible?: boolean }) {
  const { content, saving, run, feedbackLine } = useContentSave();
  const sections = content.policySections;
  const read = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    return { title: String(fd.get("title") ?? "").trim(), body: String(fd.get("body") ?? "").trim() };
  };

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (await run({ policySections: [...sections, { id: uid(), ...read(form) }] }, "Policy section added.")) form.reset();
  }

  function handleUpdate(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const next = { id, ...read(e.currentTarget) };
    void run({ policySections: sections.map((item) => (item.id === id ? next : item)) }, "Policy section updated.");
  }

  return (
    <Panel title="Manage Policies" collapsible={collapsible}>
      <p className="muted">Shown on the Policies page. Cover cancellations, payment, and how you handle student data. Separate paragraphs with a blank line.</p>
      <div className="list">
        {sections.map((item) => (
          <form className="list-item" key={item.id} onSubmit={(e) => handleUpdate(e, item.id)}>
            <label>Title<input name="title" defaultValue={item.title} required maxLength={200} /></label>
            <label>Text<textarea name="body" rows={4} defaultValue={item.body} required maxLength={20000} /></label>
            <div className="row">
              <button type="submit" disabled={saving}>Save</button>
              <button
                className="danger"
                type="button"
                disabled={saving}
                onClick={() => void run({ policySections: sections.filter((entry) => entry.id !== item.id) }, "Policy section deleted.")}
              >
                Delete
              </button>
            </div>
          </form>
        ))}
      </div>
      <form onSubmit={handleAdd}>
        <label>New section title<input name="title" required maxLength={200} placeholder="Cancellations & refunds" /></label>
        <label>Text<textarea name="body" rows={3} required maxLength={20000} /></label>
        <button className="primary" type="submit" disabled={saving}>Add Section</button>
      </form>
      {feedbackLine}
    </Panel>
  );
}
