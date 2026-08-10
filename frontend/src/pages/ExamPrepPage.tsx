import { FormEvent, useState } from "react";
import { useAppContext } from "../context/AppContext";
import type { Course, SelectableOptionKey } from "../types";

const examOptionGroups: Array<{ key: SelectableOptionKey; label: string }> = [
  { key: "serviceTypes", label: "Service Types" },
  { key: "urgencyWindows", label: "Urgency Windows" },
  { key: "assessmentSubjects", label: "Assessment Subjects" }
];

export default function ExamPrepPage() {
  const {
    db,
    currentUser,
    addExamPrepTrack,
    updateExamPrepTrack,
    deleteExamPrepTrack,
    addSelectableOption,
    updateSelectableOption,
    deleteSelectableOption
  } = useAppContext();
  const [selectedOptionGroup, setSelectedOptionGroup] = useState<SelectableOptionKey>("urgencyWindows");
  const [feedback, setFeedback] = useState("");
  const isAdmin = currentUser?.role === "admin";
  const examPrepCourses = db.examPrepTracks;

  function handleAddTrack(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) return;
    const fd = new FormData(e.currentTarget);
    addExamPrepTrack({
      title: String(fd.get("title") ?? "").trim(),
      category: "Exam Prep",
      description: String(fd.get("description") ?? "").trim()
    });
    setFeedback("Exam prep track added.");
    e.currentTarget.reset();
  }

  function handleUpdateTrack(e: FormEvent<HTMLFormElement>, course: Course) {
    e.preventDefault();
    if (!isAdmin) return;
    const fd = new FormData(e.currentTarget);
    updateExamPrepTrack(course.id, {
      title: String(fd.get("title") ?? "").trim(),
      category: "Exam Prep",
      description: String(fd.get("description") ?? "").trim()
    });
    setFeedback("Exam prep track updated.");
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

  return (
    <section data-page="exam-prep" className="page">
      <h2>Exam Prep</h2>
      <p className="muted">
        Dedicated tracks for exam strategy, topic targeting, timed practice, and mock sessions.
      </p>

      <div className="course-progress-list">
        {examPrepCourses.length ? examPrepCourses.map((course) => (
          <div className="card" key={course.id}>
            <h3>{course.title}</h3>
            <p>{course.description}</p>
          </div>
        )) : (
          <div className="card">
            <p className="muted">No exam prep tracks are configured yet.</p>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Exam Parameters</h3>
        <ul className="exam-list">
          <li><strong>Service types:</strong> {db.selectableOptions.serviceTypes.join(", ")}</li>
          <li><strong>Urgency windows:</strong> {db.selectableOptions.urgencyWindows.join(", ")}</li>
          <li><strong>Assessment subjects:</strong> {db.selectableOptions.assessmentSubjects.join(", ")}</li>
        </ul>
      </div>

      {isAdmin ? (
        <div className="dashboard-stack" id="exam-prep-admin">
          <div className="grid-2">
            <div className="card">
              <h3>Add Exam Prep Track</h3>
              <form onSubmit={handleAddTrack}>
                <label>Track Name<input name="title" placeholder="IB Math AA" required /></label>
                <label>Topics/Description<textarea name="description" rows={3} required /></label>
                <button className="primary" type="submit">Add Track</button>
              </form>
            </div>

            <div className="card">
              <h3>Manage Exam Parameters</h3>
              <label>Parameter Group
                <select
                  value={selectedOptionGroup}
                  onChange={(e) => {
                    setSelectedOptionGroup(e.target.value as SelectableOptionKey);
                    setFeedback("");
                  }}
                >
                  {examOptionGroups.map((group) => (
                    <option key={group.key} value={group.key}>{group.label}</option>
                  ))}
                </select>
              </label>
              <form onSubmit={handleAddOption}>
                <label>New Value<input name="optionValue" required /></label>
                <button className="primary" type="submit">Add Value</button>
              </form>
            </div>
          </div>

          <div className="card">
            <h3>Edit Exam Prep Tracks</h3>
            <div className="list">
              {examPrepCourses.length ? examPrepCourses.map((course) => (
                <form className="list-item" key={course.id} onSubmit={(e) => handleUpdateTrack(e, course)}>
                  <label>Track Name<input name="title" defaultValue={course.title} required /></label>
                  <label>Topics/Description<textarea name="description" rows={2} defaultValue={course.description} required /></label>
                  <div className="row">
                    <button type="submit">Save</button>
                    <button
                      className="danger"
                      type="button"
                      onClick={() => {
                        deleteExamPrepTrack(course.id);
                        setFeedback("Exam prep track deleted.");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </form>
              )) : (
                <p className="muted">No tracks to edit.</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Parameter Values: {examOptionGroups.find((group) => group.key === selectedOptionGroup)?.label}</h3>
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
                        setFeedback(result.ok ? "Parameter deleted." : result.message);
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
      ) : null}
    </section>
  );
}
