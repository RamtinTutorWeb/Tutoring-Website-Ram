import { FormEvent, useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import type { Course } from "../types";

export default function CoursesPage() {
  const { db, currentUser, addCourse, updateCourse, deleteCourse } = useAppContext();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [feedback, setFeedback] = useState("");
  const isAdmin = currentUser?.role === "admin";
  const categories = useMemo(() => db.selectableOptions.courseCategories, [db.selectableOptions.courseCategories]);

  const filteredCourses = useMemo(() => {
    if (!categoryFilter) return [];
    return db.courses.filter((course) => course.category === categoryFilter);
  }, [db.courses, categoryFilter]);

  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null;
    return filteredCourses.find((course) => course.id === selectedCourseId) ?? null;
  }, [filteredCourses, selectedCourseId]);

  function handleAddCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) return;
    const fd = new FormData(e.currentTarget);
    addCourse({
      title: String(fd.get("title") ?? "").trim(),
      category: String(fd.get("category") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim()
    });
    setFeedback("Course added.");
    e.currentTarget.reset();
  }

  function handleUpdateCourse(e: FormEvent<HTMLFormElement>, course: Course) {
    e.preventDefault();
    if (!isAdmin) return;
    const fd = new FormData(e.currentTarget);
    updateCourse(course.id, {
      title: String(fd.get("title") ?? "").trim(),
      category: String(fd.get("category") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim()
    });
    setFeedback("Course updated.");
  }

  return (
    <section data-page="courses" className="page">
      <h2>Courses</h2>
      <p className="muted">
        {isAdmin ? "Browse courses and manage the catalog." : "Filter by category and select a course to view topics covered."}
      </p>

      <div className="filters">
        <label>
          Category
          <select value={categoryFilter} onChange={(e) => {
            setCategoryFilter(e.target.value);
            setSelectedCourseId("");
          }}>
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>
        <label>
          Course
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} disabled={!categoryFilter}>
            <option value="">{categoryFilter ? "Select course" : "Select category first"}</option>
            {filteredCourses.length ? (
              filteredCourses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))
            ) : (
              null
            )}
          </select>
        </label>
      </div>

      <div className="card" id="course-details">
        {selectedCourse ? (
          <>
            <h3>{selectedCourse.title}</h3>
            <p><strong>Category:</strong> {selectedCourse.category}</p>
            <p>{selectedCourse.description}</p>
          </>
        ) : categoryFilter ? (
          <p className="muted">No courses found for this category.</p>
        ) : (
          <p className="muted">Select a category and course to display details.</p>
        )}
      </div>

      {isAdmin ? (
        <div className="dashboard-stack" id="courses-admin">
          <div className="card">
            <h3>Add Course</h3>
            <form onSubmit={handleAddCourse}>
              <label>Title<input name="title" required /></label>
              <label>Category
                <select name="category" required>
                  {db.selectableOptions.courseCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>Topics/Description<textarea name="description" rows={3} required /></label>
              <button className="primary" type="submit">Add Course</button>
            </form>
          </div>

          <div className="card">
            <h3>Edit Courses</h3>
            <div className="list">
              {db.courses.length ? db.courses.map((course) => (
                <details className="list-item course-detail" key={course.id}>
                  <summary><strong>{course.title}</strong> <span className="muted">({course.category})</span></summary>
                  <form onSubmit={(e) => handleUpdateCourse(e, course)}>
                    <label>Title<input name="title" defaultValue={course.title} required /></label>
                    <label>Category
                      <select name="category" defaultValue={course.category} required>
                        {db.selectableOptions.courseCategories.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label>Topics/Description<textarea name="description" rows={2} defaultValue={course.description} required /></label>
                    <div className="row">
                      <button type="submit">Save</button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => {
                          deleteCourse(course.id);
                          setFeedback("Course deleted.");
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                </details>
              )) : (
                <p className="muted">No courses to edit.</p>
              )}
            </div>
            <p className="feedback">{feedback}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
