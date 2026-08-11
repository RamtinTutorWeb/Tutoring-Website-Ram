import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StarRating from "../components/StarRating";
import { useAppContext } from "../context/AppContext";
import type { Course, CourseProgressStatus, FaqItem, Review, SelectableOptionKey, SessionSettings, SessionSlot, SessionSlotStatus, SessionType, User } from "../types";

const optionGroupLabels: Record<SelectableOptionKey, string> = {
  contactMethods: "Contact Methods",
  serviceTypes: "Tutoring Service Types",
  urgencyWindows: "Exam Urgency Windows",
  urgencyFlags: "Urgency Choices",
  assessmentSubjects: "Assessment Subjects",
  courseCategories: "Course Categories"
};

const optionGroupKeys = Object.keys(optionGroupLabels) as SelectableOptionKey[];

const courseStatusLabels: Record<CourseProgressStatus, string> = {
  registered: "Registered",
  "in-progress": "In Progress",
  passed: "Passed"
};

const learnerRoles: User["role"][] = ["student", "parent", "tutor"];
const calendlyUrl = "https://calendly.com/shahla-ca78/30min";
const allowedSessionDurations = [
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" }
];

function displayRole(role: User["role"]): "Admin" | "Student" {
  return role === "admin" ? "Admin" : "Student";
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime) return "";
  const [hours, minutes] = startTime.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes + durationMinutes, 0, 0);
  return date.toTimeString().slice(0, 5);
}

function slotsOverlap(a: Pick<SessionSlot, "startTime" | "endTime">, b: Pick<SessionSlot, "startTime" | "endTime">): boolean {
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime);
}

function isSlotLocked(slot: Pick<SessionSlot, "date" | "startTime">): boolean {
  return new Date(`${slot.date}T${slot.startTime}:00`).getTime() - Date.now() < 24 * 60 * 60 * 1000;
}

function monthDates(anchor: Date): string[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return Array.from({ length: last.getDate() }, (_, index) => {
    const date = new Date(year, month, index + 1);
    return date.toISOString().slice(0, 10);
  });
}

export default function DashboardPage() {
  const {
    db,
    currentUser,
    updateRequestStatus,
    addCourse,
    deleteCourse,
    assignCourseToLearner,
    updateLearnerCourseStatus,
    deleteLearnerCourse,
    addSessionSlot,
    updateSessionSlotStatus,
    reserveSessionSlot,
    deleteSessionSlot,
    updateSessionSettings,
    resetLearnerAccount,
    addReview,
    addPendingReview,
    approveReview,
    deleteReview,
    addFaq,
    deleteFaq,
    addSelectableOption,
    updateSelectableOption,
    deleteSelectableOption
  } = useAppContext();
  const navigate = useNavigate();
  const [selectedOptionGroup, setSelectedOptionGroup] = useState<SelectableOptionKey>("contactMethods");
  const [optionFeedback, setOptionFeedback] = useState("");
  const [adminFeedback, setAdminFeedback] = useState("");

  const learners = useMemo(() => db.users.filter((user) => learnerRoles.includes(user.role)), [db.users]);
  const tutors = useMemo(() => db.users.filter((user) => user.role === "tutor"), [db.users]);
  const myRequests = currentUser ? db.requests.filter((request) => request.userId === currentUser.id) : [];
  const myTests = currentUser ? db.tests.filter((test) => test.userId === currentUser.id) : [];
  const myQuestionnaires = currentUser ? db.questionnaires.filter((item) => item.userId === currentUser.id) : [];
  const myCourseRecords = currentUser ? db.learnerCourses.filter((record) => record.userId === currentUser.id) : [];

  function handleAddCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const fd = new FormData(e.currentTarget);
    addCourse({
      title: String(fd.get("title") ?? ""),
      category: String(fd.get("category") ?? "University Courses"),
      description: String(fd.get("description") ?? "")
    });
    e.currentTarget.reset();
  }

  function handleAddReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const fd = new FormData(e.currentTarget);
    addReview(String(fd.get("name") ?? ""), Number(fd.get("rating") ?? 5), String(fd.get("text") ?? ""));
    e.currentTarget.reset();
  }

  function handleSubmitStudentReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser || !learnerRoles.includes(currentUser.role)) return;
    const fd = new FormData(e.currentTarget);
    addPendingReview(currentUser.name, Number(fd.get("rating") ?? 5), String(fd.get("text") ?? ""));
    e.currentTarget.reset();
  }

  function handleAddFaq(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const fd = new FormData(e.currentTarget);
    addFaq(String(fd.get("question") ?? ""), String(fd.get("answer") ?? ""));
    e.currentTarget.reset();
  }

  async function handleResetLearner(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const fd = new FormData(e.currentTarget);
    const result = await resetLearnerAccount(String(fd.get("email") ?? ""));
    setAdminFeedback(result.message);
    if (result.ok) e.currentTarget.reset();
  }

  function handleAssignCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const fd = new FormData(e.currentTarget);
    const result = assignCourseToLearner({
      userId: String(fd.get("userId") ?? ""),
      courseId: String(fd.get("courseId") ?? ""),
      status: String(fd.get("status") ?? "registered") as CourseProgressStatus
    });
    setAdminFeedback(result.message);
    if (result.ok) e.currentTarget.reset();
  }

  async function handleAddSelectableOption(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const fd = new FormData(e.currentTarget);
    const result = await addSelectableOption(selectedOptionGroup, String(fd.get("optionValue") ?? ""));
    setOptionFeedback(result.message);
    if (result.ok) e.currentTarget.reset();
  }

  async function handleUpdateSelectableOption(e: FormEvent<HTMLFormElement>, index: number) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const fd = new FormData(e.currentTarget);
    const result = await updateSelectableOption(selectedOptionGroup, index, String(fd.get("optionValue") ?? ""));
    setOptionFeedback(result.message);
  }

  function getCourse(courseId: string): Course | undefined {
    return db.courses.find((course) => course.id === courseId);
  }

  function getUser(userId: string): User | undefined {
    return db.users.find((user) => user.id === userId);
  }

  if (!currentUser) {
    return (
      <section data-page="dashboard" className="page">
        <h2>Dashboard</h2>
        <div className="card">
          <p>Login required.</p>
        </div>
      </section>
    );
  }

  return (
    <section data-page="dashboard" className="page dashboard-page">
      <DashboardHeader currentUser={currentUser} />

      {learnerRoles.includes(currentUser.role) ? (
        <LearnerDashboard
          currentUser={currentUser}
          courseRecords={myCourseRecords}
          courses={db.courses}
          requests={myRequests}
          tests={myTests}
          questionnaires={myQuestionnaires}
          tutors={tutors}
          sessionSlots={db.sessionSlots}
          sessionSettings={db.sessionSettings}
          addSessionSlot={addSessionSlot}
          reserveSessionSlot={reserveSessionSlot}
          handleSubmitStudentReview={handleSubmitStudentReview}
        />
      ) : null}

      {currentUser.role === "admin" ? (
        <div className="dashboard-stack" id="admin-dashboard">
          <div className="dashboard-grid">
            <StatCard label="Students" value={learners.length} />
            <StatCard label="Courses" value={db.courses.length} />
            <StatCard label="Open Requests" value={db.requests.filter((request) => request.status !== "closed").length} />
          </div>

          <div className="card">
            <h3>Display Preview</h3>
            <p className="muted">Open the same display pages students and visitors use.</p>
            <div className="row">
              <button type="button" onClick={() => navigate("/")}>Home</button>
              <button type="button" onClick={() => navigate("/courses")}>Courses</button>
              <button type="button" onClick={() => navigate("/exam-prep")}>Exam Prep</button>
              <button type="button" onClick={() => navigate("/contact")}>Contact</button>
            </div>
          </div>

          <div className="card">
            <h3>Reset Student Account</h3>
            <form onSubmit={handleResetLearner}>
              <label>Student Email<input name="email" type="email" required /></label>
              <button className="primary" type="submit">Send Reset Link</button>
            </form>
            <p className="feedback">{adminFeedback}</p>
          </div>

          <div className="grid-2">
            <ManageCoursesCard
              courses={db.courses}
              courseCategories={db.selectableOptions.courseCategories}
              onAdd={handleAddCourse}
              onDelete={deleteCourse}
            />

            <div className="card">
              <h3>Assign Course To Student</h3>
              <form onSubmit={handleAssignCourse}>
                <label>Student
                  <select name="userId" required>
                    <option value="">Select student</option>
                    {learners.map((learner) => (
                      <option key={learner.id} value={learner.id}>{learner.name} - {learner.email}</option>
                    ))}
                  </select>
                </label>
                <label>Course
                  <select name="courseId" required>
                    <option value="">Select course</option>
                    {db.courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                </label>
                <label>Status
                  <select name="status" required>
                    {Object.entries(courseStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <button className="primary" type="submit">Assign Course</button>
              </form>
            </div>
          </div>

          {/*
            Rollback option: restore the full internal calendar for Admin by uncommenting this component.
            <SessionCalendarCard
              currentUser={currentUser}
              tutors={tutors}
              sessionSlots={db.sessionSlots}
              sessionSettings={db.sessionSettings}
              addSessionSlot={addSessionSlot}
              updateSessionSlotStatus={updateSessionSlotStatus}
              reserveSessionSlot={reserveSessionSlot}
              deleteSessionSlot={deleteSessionSlot}
              updateSessionSettings={updateSessionSettings}
            />
          */}
          <div className="card">
            <h3>Session Reservation</h3>
            <p className="muted">Use Calendly to reserve a session. Session duration must be 1, 2, or 3 hours.</p>
            <a className="button-link primary" href={calendlyUrl} target="_blank" rel="noreferrer">
              Reserve Session With Calendly
            </a>
          </div>

          {/* <SessionCalendarCard
            currentUser={currentUser}
            tutors={tutors}
            sessionSlots={db.sessionSlots}
            sessionSettings={db.sessionSettings}
            addSessionSlot={addSessionSlot}
            updateSessionSlotStatus={updateSessionSlotStatus}
            reserveSessionSlot={reserveSessionSlot}
            deleteSessionSlot={deleteSessionSlot}
            updateSessionSettings={updateSessionSettings}
          /> */}

          <div className="card">
            <h3>Student Course Progress</h3>
            <p className="muted">For full notes and student needs, check the Detail Request tab.</p>
            <div className="list">
              {db.learnerCourses.length ? db.learnerCourses.map((record) => {
                const learner = getUser(record.userId);
                const course = getCourse(record.courseId);
                return (
                  <div className="list-item learner-course-row" key={record.id}>
                    <div>
                      <strong>{learner?.name ?? "Unknown student"}</strong>
                      <p className="muted">{course?.title ?? "Unknown course"} | {learner?.email ?? "No email"}</p>
                    </div>
                    <div className="row">
                      <select
                        aria-label="Course status"
                        value={record.status}
                        onChange={(e) => updateLearnerCourseStatus(record.id, e.target.value as CourseProgressStatus)}
                      >
                        {Object.entries(courseStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <button className="danger" type="button" onClick={() => deleteLearnerCourse(record.id)}>Remove</button>
                    </div>
                  </div>
                );
              }) : <p className="muted">No student courses assigned yet.</p>}
            </div>
          </div>

          <RequestsCard requests={db.requests} updateRequestStatus={updateRequestStatus} />

          <div className="grid-2">
            <ReviewsCard reviews={db.reviews} handleAddReview={handleAddReview} approveReview={approveReview} deleteReview={deleteReview} />
            <FaqCard faq={db.faq} handleAddFaq={handleAddFaq} deleteFaq={deleteFaq} />
          </div>

          <div className="card">
            <h3>Manage Student Form Options</h3>
            <label>
              Option Group
              <select
                value={selectedOptionGroup}
                onChange={(e) => {
                  setSelectedOptionGroup(e.target.value as SelectableOptionKey);
                  setOptionFeedback("");
                }}
              >
                {optionGroupKeys.map((key) => (
                  <option key={key} value={key}>{optionGroupLabels[key]}</option>
                ))}
              </select>
            </label>

            <form onSubmit={handleAddSelectableOption}>
              <label>New Option<input name="optionValue" required /></label>
              <button className="primary" type="submit">Add Option</button>
            </form>

            <div className="list">
              {db.selectableOptions[selectedOptionGroup].map((option, index) => (
                <form className="list-item" key={`${selectedOptionGroup}-${option}-${index}`} onSubmit={(e) => handleUpdateSelectableOption(e, index)}>
                  <label>Option Value<input name="optionValue" defaultValue={option} required /></label>
                  <div className="row">
                    <button type="submit">Save</button>
                    <button
                      className="danger"
                      type="button"
                      onClick={async () => {
                        const result = await deleteSelectableOption(selectedOptionGroup, index);
                        setOptionFeedback(result.ok ? "Option deleted." : result.message);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </form>
              ))}
            </div>
            <p className="feedback">{optionFeedback}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DashboardHeader({ currentUser }: { currentUser: User }) {
  const visibleRole = displayRole(currentUser.role);
  return (
    <div className="dashboard-hero">
      <div>
        <p className="hero-kicker">{visibleRole} portal</p>
        <h2>{currentUser.name}</h2>
        <p>{currentUser.email}</p>
      </div>
      <span className="role-pill">{visibleRole}</span>
    </div>
  );
}

function LearnerDashboard({
  currentUser,
  courseRecords,
  courses,
  requests,
  tests,
  questionnaires,
  tutors,
  sessionSlots,
  sessionSettings,
  addSessionSlot,
  reserveSessionSlot,
  handleSubmitStudentReview
}: {
  currentUser: User;
  courseRecords: { courseId: string; status: CourseProgressStatus; registeredAt: string; id: string }[];
  courses: Course[];
  requests: { id: string; serviceType: string; status: string; message: string }[];
  tests: { id: string; score: number; total: number; recommendation: string; createdAt: string }[];
  questionnaires: { id: string; subject: string; goal: string; createdAt: string }[];
  tutors: User[];
  sessionSlots: SessionSlot[];
  sessionSettings: SessionSettings;
  addSessionSlot: (slot: Omit<SessionSlot, "id">) => { ok: boolean; message: string };
  reserveSessionSlot: (slotId: string, learnerName: string, notes?: string) => void;
  handleSubmitStudentReview: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const statusCounts = courseRecords.reduce<Record<CourseProgressStatus, number>>(
    (acc, record) => ({ ...acc, [record.status]: acc[record.status] + 1 }),
    { registered: 0, "in-progress": 0, passed: 0 }
  );

  return (
    <div className="dashboard-stack" id="learner-dashboard">
      <div className="dashboard-grid">
        <StatCard label="Registered" value={statusCounts.registered} />
        <StatCard label="In Progress" value={statusCounts["in-progress"]} />
        <StatCard label="Passed" value={statusCounts.passed} />
        <StatCard label="Requests" value={requests.length} />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>My Information</h3>
          <div className="profile-lines">
            <p><strong>Name:</strong> {currentUser.name}</p>
            <p><strong>Email:</strong> {currentUser.email}</p>
            <p><strong>Role:</strong> {displayRole(currentUser.role)}</p>
          </div>
        </div>

        <div className="card">
          <h3>Assessment Summary</h3>
          {tests.length || questionnaires.length ? (
            <>
              {tests.slice(-2).map((test) => (
                <div className="list-item" key={test.id}>
                  <strong>{test.score}/{test.total}</strong>
                  <p>{test.recommendation}</p>
                </div>
              ))}
              {questionnaires.slice(-2).map((item) => (
                <div className="list-item" key={item.id}>
                  <strong>{item.subject}</strong>
                  <p>{item.goal}</p>
                </div>
              ))}
            </>
          ) : (
            <p className="muted">No assessment activity yet.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>My Courses</h3>
        <div className="course-progress-list">
          {courseRecords.length ? courseRecords.map((record) => {
            const course = courses.find((item) => item.id === record.courseId);
            return (
              <div className={`list-item status-${record.status}`} key={record.id}>
                <div className="course-progress-head">
                  <strong>{course?.title ?? "Course removed"}</strong>
                  <span>{courseStatusLabels[record.status]}</span>
                </div>
                <p className="muted">{course?.category ?? "No category"}</p>
                <p>{course?.description ?? "This course is no longer available."}</p>
              </div>
            );
          }) : (
            <p className="muted">No courses assigned yet.</p>
          )}
        </div>
      </div>

      {/*
        Rollback option: restore the full internal calendar for Student by uncommenting this component.
        <SessionCalendarCard
          currentUser={currentUser}
          tutors={tutors}
          sessionSlots={sessionSlots}
          sessionSettings={sessionSettings}
          addSessionSlot={addSessionSlot}
          reserveSessionSlot={reserveSessionSlot}
        />
      */}
      <div className="card">
        <h3>Session Reservation</h3>
        <p className="muted">Use Calendly to reserve a session. Session duration must be 1, 2, or 3 hours.</p>
        <a className="button-link primary" href={calendlyUrl} target="_blank" rel="noreferrer">
          Reserve Session With Calendly
        </a>
      </div>

      {/* <SessionCalendarCard
        currentUser={currentUser}
        tutors={tutors}
        sessionSlots={sessionSlots}
        sessionSettings={sessionSettings}
        addSessionSlot={addSessionSlot}
        reserveSessionSlot={reserveSessionSlot}
      /> */}

      <div className="card">
        <h3>Leave A Review</h3>
        <form onSubmit={handleSubmitStudentReview}>
          <label>Rating
            <select name="rating" defaultValue="5">
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
          </label>
          <label>Review<textarea name="text" rows={3} required /></label>
          <button className="primary" type="submit">Submit For Approval</button>
        </form>
        <p className="muted">Reviews appear on the home page after admin approval.</p>
      </div>

      <div className="card" id="student-request-history">
        <h3>My Booking Requests</h3>
        {requests.length ? (
          requests.map((request) => (
            <div className="list-item" key={request.id}>
              <strong>{request.serviceType}</strong> - {request.status}
              <p>{request.message}</p>
            </div>
          ))
        ) : (
          <p className="muted">No requests yet.</p>
        )}
      </div>
    </div>
  );
}

function TutorDashboard({
  currentUser,
  requests,
  courses,
  reviews,
  sessionSlots,
  sessionSettings,
  tutors,
  updateRequestStatus,
  addSessionSlot,
  updateSessionSlotStatus,
  reserveSessionSlot,
  deleteSessionSlot,
  updateSessionSettings
}: {
  currentUser: User;
  requests: { id: string; name: string; serviceType: string; status: "new" | "replied" | "closed"; message: string }[];
  courses: Course[];
  reviews: Review[];
  sessionSlots: SessionSlot[];
  sessionSettings: SessionSettings;
  tutors: User[];
  updateRequestStatus: (requestId: string, status: "replied" | "closed") => void;
  addSessionSlot: (slot: Omit<SessionSlot, "id">) => { ok: boolean; message: string };
  updateSessionSlotStatus: (slotId: string, status: SessionSlotStatus) => void;
  reserveSessionSlot: (slotId: string, learnerName: string, notes?: string) => void;
  deleteSessionSlot: (slotId: string) => void;
  updateSessionSettings: (settings: SessionSettings) => void;
}) {
  return (
    <div className="dashboard-stack" id="tutor-dashboard">
      <div className="dashboard-grid">
        <StatCard label="Open Requests" value={requests.filter((request) => request.status !== "closed").length} />
        <StatCard label="Courses" value={courses.length} />
        <StatCard label="Reviews" value={reviews.length} />
        <StatCard label="Tutor" value={currentUser.name.split(" ")[0] || "Active"} />
      </div>

      <RequestsCard requests={requests} updateRequestStatus={updateRequestStatus} />

      <SessionCalendarCard
        currentUser={currentUser}
        tutors={tutors}
        sessionSlots={sessionSlots}
        sessionSettings={sessionSettings}
        addSessionSlot={addSessionSlot}
        updateSessionSlotStatus={updateSessionSlotStatus}
        reserveSessionSlot={reserveSessionSlot}
        deleteSessionSlot={deleteSessionSlot}
        updateSessionSettings={updateSessionSettings}
      />

      <div className="grid-2">
        <div className="card">
          <h3>Course Catalog</h3>
          <div className="list">
            {courses.map((course) => (
              <details className="list-item course-detail" key={course.id}>
                <summary><strong>{course.title}</strong> <span className="muted">({course.category})</span></summary>
                <p>{course.description}</p>
              </details>
            ))}
          </div>
        </div>
        <ReviewsReadOnlyCard reviews={reviews} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RequestsCard({
  requests,
  updateRequestStatus
}: {
  requests: { id: string; name: string; serviceType: string; status: "new" | "replied" | "closed"; message: string }[];
  updateRequestStatus: (requestId: string, status: "replied" | "closed") => void;
}) {
  return (
    <div className="card">
      <h3>Incoming Requests</h3>
      {requests.length ? (
        [...requests].reverse().map((request) => (
          <div className="list-item" key={request.id}>
            <p><strong>{request.name}</strong> | {request.serviceType} | status: {request.status}</p>
            <p>{request.message}</p>
            <div className="row">
              <button type="button" onClick={() => updateRequestStatus(request.id, "replied")}>Mark Replied</button>
              <button type="button" onClick={() => updateRequestStatus(request.id, "closed")}>Mark Closed</button>
            </div>
          </div>
        ))
      ) : (
        <p className="muted">No incoming requests yet.</p>
      )}
    </div>
  );
}

function SessionCalendarCard({
  currentUser,
  tutors,
  sessionSlots,
  sessionSettings,
  addSessionSlot,
  updateSessionSlotStatus,
  reserveSessionSlot,
  deleteSessionSlot,
  updateSessionSettings
}: {
  currentUser: User;
  tutors: User[];
  sessionSlots: SessionSlot[];
  sessionSettings: SessionSettings;
  addSessionSlot?: (slot: Omit<SessionSlot, "id">) => { ok: boolean; message: string };
  updateSessionSlotStatus?: (slotId: string, status: SessionSlotStatus) => void;
  reserveSessionSlot: (slotId: string, learnerName: string, notes?: string) => void;
  deleteSessionSlot?: (slotId: string) => void;
  updateSessionSettings?: (settings: SessionSettings) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonthDate = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [dayDetailDate, setDayDetailDate] = useState("");
  const [addingSlot, setAddingSlot] = useState(false);
  const [calendarFeedback, setCalendarFeedback] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);
  const isAdmin = currentUser.role === "admin";
  const isTutor = false;
  const canManageSlots = isAdmin;
  const activeMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + monthOffset, 1);
  const visibleSlots = sessionSlots
    .filter((slot) => isAdmin || !isTutor || slot.tutorId === currentUser.id)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const selectedDateSlots = visibleSlots.filter((slot) => slot.date === selectedDate);
  const selectedSlot = selectedSlotId ? visibleSlots.find((slot) => slot.id === selectedSlotId) : undefined;
  const calendarDays = monthDates(activeMonth);
  const startOptions = Array.from(
    { length: Math.max(sessionSettings.dayEndHour - sessionSettings.dayStartHour, 1) },
    (_, index) => formatHour(sessionSettings.dayStartHour + index)
  );
  const selectedSessionTypes = sessionSettings.sessionTypes.length
    ? sessionSettings.sessionTypes
    : [{ id: "default-session-type", purpose: "Tutoring Session", durationMinutes: sessionSettings.slotDurationMinutes }];

  function durationForPurpose(purpose: string): number {
    return selectedSessionTypes.find((type) => type.purpose === purpose)?.durationMinutes ?? sessionSettings.slotDurationMinutes;
  }

  function availableStartOptions(date: string, tutorId: string, purpose: string): string[] {
    const durationMinutes = durationForPurpose(purpose);
    const maxEndMinutes = sessionSettings.dayEndHour * 60;
    return startOptions.filter((startTime) => {
      const candidate = { startTime, endTime: calculateEndTime(startTime, durationMinutes) };
      if (timeToMinutes(candidate.endTime) > maxEndMinutes) return false;
      return !sessionSlots.some((slot) => (
        slot.tutorId === tutorId &&
        slot.date === date &&
        slotsOverlap(slot, candidate)
      ));
    });
  }

  function handleAddSlot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addSessionSlot || !canManageSlots) return;
    const fd = new FormData(e.currentTarget);
    const purpose = String(fd.get("purpose") ?? selectedSessionTypes[0]?.purpose ?? "Tutoring Session");
    const startTime = String(fd.get("startTime") ?? "");
    const result = addSessionSlot({
      tutorId: isAdmin ? String(fd.get("tutorId") ?? "") : currentUser.id,
      date: String(fd.get("date") ?? selectedDate),
      startTime,
      endTime: calculateEndTime(startTime, durationForPurpose(purpose)),
      purpose,
      status: String(fd.get("status") ?? "available") as SessionSlotStatus,
      learnerName: String(fd.get("learnerName") ?? "").trim(),
      notes: String(fd.get("notes") ?? "").trim()
    });
    setCalendarFeedback(result.message);
    if (!result.ok) return;
    e.currentTarget.reset();
    setAddingSlot(false);
    setSelectedSlotId("");
    setSelectedDate(String(fd.get("date") ?? selectedDate));
  }

  function tutorName(tutorId: string): string {
    return tutors.find((tutor) => tutor.id === tutorId)?.name ?? (tutorId === currentUser.id ? currentUser.name : "Instructor");
  }

  function getDayCounts(date: string): { available: number; reserved: number } {
    const slots = visibleSlots.filter((slot) => slot.date === date);
    const reserved = slots.filter((slot) => getSlotStatus(slot) === "reserved").length;
    const total = sessionSettings.defaultDailySlots;
    return {
      available: Math.max(total - reserved, 0),
      reserved
    };
  }

  function getDayAvailability(date: string): { className: string; label: string; available: number; reserved: number } {
    const counts = getDayCounts(date);
    if (counts.available > 0) {
      return { ...counts, className: "available", label: "Available" };
    }
    if (counts.reserved > 0) {
      return { ...counts, className: "unavailable", label: "Unavailable - all reserved" };
    }
    return { ...counts, className: "available", label: "Available by default" };
  }

  function handleCalendarDayClick(date: string): void {
    setSelectedDate(date);
    setSelectedSlotId("");
    setAddingSlot(false);
    setCalendarFeedback("");
    setDayDetailDate(date);
  }

  function getSlotStatus(slot: SessionSlot): SessionSlotStatus {
    return slot.status === "reserved" ? "reserved" : "available";
  }

  function handleReserveSlot(e: FormEvent<HTMLFormElement>, slot: SessionSlot) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    reserveSessionSlot(
      slot.id,
      String(fd.get("learnerName") ?? currentUser.name).trim() || currentUser.name,
      String(fd.get("notes") ?? "")
    );
    closeDetails();
  }

  function closeDetails(): void {
    setSelectedSlotId("");
    setDayDetailDate("");
    setAddingSlot(false);
    setCalendarFeedback("");
  }

  function handleDefaultReservation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addSessionSlot) return;
    const fd = new FormData(e.currentTarget);
    const tutorId = String(fd.get("tutorId") ?? tutors[0]?.id ?? currentUser.id);
    const purpose = String(fd.get("purpose") ?? selectedSessionTypes[0]?.purpose ?? "Tutoring Session");
    const startTime = String(fd.get("startTime") ?? "");
    const result = addSessionSlot({
      tutorId,
      date: dayDetailDate,
      startTime,
      endTime: calculateEndTime(startTime, durationForPurpose(purpose)),
      purpose,
      status: "reserved",
      learnerName: String(fd.get("learnerName") ?? currentUser.name).trim() || currentUser.name,
      notes: String(fd.get("notes") ?? "").trim()
    });
    setCalendarFeedback(result.message);
    if (!result.ok) return;
    closeDetails();
  }

  function handleSessionSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!updateSessionSettings) return;
    const fd = new FormData(e.currentTarget);
    const purposes = fd.getAll("sessionPurpose").map((value) => String(value).trim());
    const durations = fd.getAll("sessionDuration").map((value) => Number(value));
    const sessionTypes: SessionType[] = purposes
      .map((purpose, index) => ({
        id: sessionSettings.sessionTypes[index]?.id ?? `${purpose || "session"}-${index}`,
        purpose,
        durationMinutes: durations[index] || sessionSettings.slotDurationMinutes
      }))
      .filter((type) => type.purpose);
    updateSessionSettings({
      defaultDailySlots: Number(fd.get("defaultDailySlots") ?? sessionSettings.defaultDailySlots),
      slotDurationMinutes: Number(fd.get("slotDurationMinutes") ?? sessionSettings.slotDurationMinutes),
      dayStartHour: Number(fd.get("dayStartHour") ?? sessionSettings.dayStartHour),
      dayEndHour: Number(fd.get("dayEndHour") ?? sessionSettings.dayEndHour),
      sessionTypes
    });
    setCalendarFeedback("Calendar settings saved.");
  }

  if (dayDetailDate) {
    const reservableTutors = tutors.length ? tutors : [currentUser];
    const initialPurpose = selectedSessionTypes[0]?.purpose ?? "Tutoring Session";
    const daySlots = visibleSlots.filter((slot) => slot.date === dayDetailDate);
    const reservedSlots = daySlots.filter((slot) => getSlotStatus(slot) === "reserved");
    const availableCount = getDayCounts(dayDetailDate).available;
    const availableStarts = availableStartOptions(dayDetailDate, reservableTutors[0]?.id ?? currentUser.id, initialPurpose);
    const canReserveAnother = availableCount > 0 && availableStarts.length > 0;

    return (
      <div className="session-modal-backdrop">
        <div className="card session-modal">
          <h3>Sessions For {dayDetailDate}</h3>
          <p className="muted">{availableCount} available | {reservedSlots.length} reserved</p>

          <div className="grid-2">
            <div>
              <h4>Reserved Sessions</h4>
              <div className="calendar-slots compact">
                {reservedSlots.length ? reservedSlots.map((slot) => (
                  <button
                    className="calendar-slot-button reserved"
                    type="button"
                    key={slot.id}
                    onClick={() => {
                      setDayDetailDate("");
                      setSelectedSlotId(slot.id);
                    }}
                  >
                    <strong>{slot.startTime} - {slot.endTime}</strong>
                    <span>{tutorName(slot.tutorId)} | {slot.purpose ?? "Tutoring Session"}</span>
                  </button>
                )) : (
                  <p className="muted">No reserved sessions for this date.</p>
                )}
              </div>
            </div>

            <div>
              <h4>Reserve Available Time</h4>
              {canReserveAnother ? (
                <>
                  <iframe className="calendly-frame small" title="Calendly booking" src={calendlyUrl}></iframe>
                  <form onSubmit={handleDefaultReservation}>
                    <label>Your Name<input name="learnerName" defaultValue={currentUser.name} required /></label>
                    <label>Instructor
                      <select name="tutorId" required>
                        {reservableTutors.map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.name}</option>)}
                      </select>
                    </label>
                    <label>Purpose
                      <select name="purpose" defaultValue={initialPurpose} required>
                        {selectedSessionTypes.map((type) => (
                          <option key={type.id} value={type.purpose}>{type.purpose} ({type.durationMinutes} min)</option>
                        ))}
                      </select>
                    </label>
                    <label>Start Time
                      <select name="startTime" required>
                        {availableStarts.map((time) => <option key={time} value={time}>{time}</option>)}
                      </select>
                    </label>
                    <label>Reservation Notes<textarea name="notes" rows={2} placeholder="Subject, goal, or timing note" /></label>
                    <button className="primary" type="submit">Validate Choice</button>
                  </form>
                </>
              ) : (
                <p className="muted">All available sessions for this date are already reserved.</p>
              )}
            </div>
          </div>

          <button type="button" onClick={closeDetails}>Back To Calendar</button>
          <p className={`feedback ${calendarFeedback ? "error" : ""}`}>{calendarFeedback}</p>
        </div>
      </div>
    );
  }

  if (selectedSlot) {
    const selectedStatus = getSlotStatus(selectedSlot);
    return (
      <div className="session-modal-backdrop">
        <div className="card session-modal">
          <h3>{selectedStatus === "reserved" ? "Reservation Detail" : "Available Slot"}</h3>
          <p className="muted">{selectedSlot.date} | {selectedSlot.startTime} - {selectedSlot.endTime}</p>
          {isSlotLocked(selectedSlot) && selectedStatus === "reserved" ? (
            <p className="feedback error">This reservation is locked less than 24 hours before start time and cannot be cancelled.</p>
          ) : null}
          <div className={`calendar-slot ${selectedStatus}`}>
            <div>
              <strong>{tutorName(selectedSlot.tutorId)}</strong>
              <p>Purpose: {selectedSlot.purpose ?? "Tutoring Session"}</p>
              <p>Status: {selectedStatus}</p>
              {selectedSlot.learnerName ? <p>Student: {selectedSlot.learnerName}</p> : null}
              {selectedSlot.notes ? <p>{selectedSlot.notes}</p> : null}
            </div>
          </div>
          {selectedStatus === "available" && !canManageSlots ? (
            <form onSubmit={(e) => handleReserveSlot(e, selectedSlot)}>
              <label>Your Name<input name="learnerName" defaultValue={currentUser.name} required /></label>
              <label>Reservation Notes<textarea name="notes" rows={2} placeholder="Subject, goal, or timing note" /></label>
              <iframe className="calendly-frame small" title="Calendly booking" src={calendlyUrl}></iframe>
              <button className="primary" type="submit">Validate Choice</button>
            </form>
          ) : null}
          <div className="row">
            {canManageSlots && updateSessionSlotStatus ? (
              <button className="primary" type="button" disabled={selectedStatus === "reserved" && isSlotLocked(selectedSlot)} onClick={() => {
                updateSessionSlotStatus(selectedSlot.id, selectedStatus === "reserved" ? "available" : "reserved");
                closeDetails();
              }}>
                {selectedStatus === "reserved" ? "Make Available" : "Make Reserved"}
              </button>
            ) : null}
            {canManageSlots && deleteSessionSlot ? (
              <button className="danger" type="button" disabled={isSlotLocked(selectedSlot)} onClick={() => {
                deleteSessionSlot(selectedSlot.id);
                closeDetails();
              }}>Delete Slot</button>
            ) : null}
            <button type="button" onClick={closeDetails}>Back To Calendar</button>
          </div>
        </div>
      </div>
    );
  }

  if (addingSlot && canManageSlots) {
    const initialPurpose = selectedSessionTypes[0]?.purpose ?? "Tutoring Session";
    return (
      <div className="card">
        <h3>Add Session Slot</h3>
        <form onSubmit={handleAddSlot}>
          {isAdmin ? (
            <label>Instructor
              <select name="tutorId" required>
                <option value="">Select instructor</option>
                {tutors.map((tutor) => (
                  <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label>Date<input name="date" type="date" defaultValue={selectedDate} required /></label>
          <label>Purpose
            <select name="purpose" defaultValue={initialPurpose} required>
              {selectedSessionTypes.map((type) => (
                <option key={type.id} value={type.purpose}>{type.purpose} ({type.durationMinutes} min)</option>
              ))}
            </select>
          </label>
          <label>Start Time
            <select name="startTime" required>
              {startOptions.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
          </label>
          <label>Status
            <select name="status" defaultValue="available">
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
            </select>
          </label>
          <label>Student Name<input name="learnerName" /></label>
          <label>Notes<textarea name="notes" rows={2} /></label>
          <div className="row">
            <button className="primary" type="submit">Save Slot</button>
            <button type="button" onClick={closeDetails}>Back To Calendar</button>
          </div>
        </form>
        <p className={`feedback ${calendarFeedback ? "error" : ""}`}>{calendarFeedback}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Session Calendar</h3>
      <p className="muted">Default schedule: {sessionSettings.defaultDailySlots} sessions per day, {formatHour(sessionSettings.dayStartHour)} to {formatHour(sessionSettings.dayEndHour)}. Cancellations lock 24 hours before start.</p>
      <div className="row calendar-nav">
        <button type="button" onClick={() => setMonthOffset((value) => value - 1)}>Previous</button>
        <strong>{activeMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
        <button type="button" onClick={() => setMonthOffset((value) => value + 1)}>Next</button>
      </div>

      <div className="calendar-overview">
        {calendarDays.map((date) => {
          const dayAvailability = getDayAvailability(date);
          const dayLabel = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
          return (
            <button
              className={`calendar-day ${dayAvailability.className} ${selectedDate === date ? "active" : ""}`}
              type="button"
              key={date}
              onClick={() => handleCalendarDayClick(date)}
            >
              <strong>{dayLabel}</strong>
              <span className="calendar-day-status">{dayAvailability.label}</span>
              <span>{dayAvailability.available} available slots</span>
              <span>{dayAvailability.reserved} reserved slots</span>
            </button>
          );
        })}
      </div>

      {canManageSlots && updateSessionSettings ? (
        <form className="calendar-settings" onSubmit={handleSessionSettings}>
          <label>Max Sessions Per Day<input name="defaultDailySlots" type="number" min={1} defaultValue={sessionSettings.defaultDailySlots} required /></label>
          <label>Default Duration
            <select name="slotDurationMinutes" defaultValue={sessionSettings.slotDurationMinutes}>
              {allowedSessionDurations.map((duration) => (
                <option key={duration.minutes} value={duration.minutes}>{duration.label}</option>
              ))}
            </select>
          </label>
          <label>Start Hour<input name="dayStartHour" type="number" min={0} max={23} defaultValue={sessionSettings.dayStartHour} required /></label>
          <label>End Hour<input name="dayEndHour" type="number" min={1} max={24} defaultValue={sessionSettings.dayEndHour} required /></label>
          {selectedSessionTypes.map((type) => (
            <div className="session-type-row" key={type.id}>
              <label>Session Purpose<input name="sessionPurpose" defaultValue={type.purpose} required /></label>
              <label>Duration
                <select name="sessionDuration" defaultValue={type.durationMinutes}>
                  {allowedSessionDurations.map((duration) => (
                    <option key={duration.minutes} value={duration.minutes}>{duration.label}</option>
                  ))}
                </select>
              </label>
            </div>
          ))}
          <button type="submit">Save Calendar Settings</button>
        </form>
      ) : null}

      <div className="calendar-slots compact">
        {selectedDateSlots.length ? selectedDateSlots.map((slot) => (
          <button
            className={`calendar-slot-button ${getSlotStatus(slot)}`}
            type="button"
            key={slot.id}
            onClick={() => setSelectedSlotId(slot.id)}
          >
            <strong>{slot.startTime} - {slot.endTime}</strong>
            <span>{tutorName(slot.tutorId)} | {slot.purpose ?? "Tutoring Session"} | {getSlotStatus(slot)}</span>
          </button>
        )) : (
          <p className="muted">No saved slots for this date. Available sessions are created when a user validates a time.</p>
        )}
      </div>

      {canManageSlots ? (
        <button className="primary" type="button" onClick={() => setAddingSlot(true)}>Add Slot</button>
      ) : null}
      <p className="feedback">{calendarFeedback}</p>
    </div>
  );
}
function ManageCoursesCard({
  courses,
  courseCategories,
  onAdd,
  onDelete
}: {
  courses: Course[];
  courseCategories: string[];
  onAdd: (e: FormEvent<HTMLFormElement>) => void;
  onDelete: (courseId: string) => void;
}) {
  return (
    <div className="card">
      <h3>Manage Courses</h3>
      <form onSubmit={onAdd}>
        <label>Title<input name="title" required /></label>
        <label>Category
          <select name="category" required>
            {courseCategories.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>Topics/Description<textarea name="description" rows={3} required /></label>
        <button className="primary" type="submit">Add Course</button>
      </form>
      <div className="list">
        {courses.map((course) => (
          <details className="list-item course-detail" key={course.id}>
            <summary><strong>{course.title}</strong> <span className="muted">({course.category})</span></summary>
            <p>{course.description}</p>
            <button className="danger" type="button" onClick={() => onDelete(course.id)}>Delete</button>
          </details>
        ))}
      </div>
    </div>
  );
}

function ReviewsCard({
  reviews,
  handleAddReview,
  approveReview,
  deleteReview
}: {
  reviews: Review[];
  handleAddReview: (e: FormEvent<HTMLFormElement>) => void;
  approveReview: (reviewId: string) => void;
  deleteReview: (reviewId: string) => void;
}) {
  return (
    <div className="card">
      <h3>Manage Reviews</h3>
      <form onSubmit={handleAddReview}>
        <label>Name/Initials<input name="name" required /></label>
        <label>Rating (1-5)<input name="rating" type="number" min={1} max={5} required /></label>
        <label>Review<textarea name="text" rows={2} required /></label>
        <button className="primary" type="submit">Add Review</button>
      </form>
      <div className="list">
        {reviews.map((review) => (
          <div className="list-item" key={review.id}>
            <strong>{review.name}</strong> <StarRating rating={Number(review.rating)} />
            <p className="muted">Status: {review.status ?? "approved"}</p>
            <p>{review.text}</p>
            {review.status === "pending" ? (
              <button type="button" onClick={() => approveReview(review.id)}>Approve</button>
            ) : null}
            <button className="danger" type="button" onClick={() => deleteReview(review.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsReadOnlyCard({ reviews }: { reviews: Review[] }) {
  return (
    <div className="card">
      <h3>Student Reviews</h3>
      <div className="list">
        {reviews.length ? reviews.map((review) => (
          <div className="list-item" key={review.id}>
            <strong>{review.name}</strong> <StarRating rating={Number(review.rating)} />
            <p>{review.text}</p>
          </div>
        )) : (
          <p className="muted">No reviews yet.</p>
        )}
      </div>
    </div>
  );
}

function FaqCard({
  faq,
  handleAddFaq,
  deleteFaq
}: {
  faq: FaqItem[];
  handleAddFaq: (e: FormEvent<HTMLFormElement>) => void;
  deleteFaq: (faqId: string) => void;
}) {
  return (
    <div className="card">
      <h3>Manage FAQ</h3>
      <form onSubmit={handleAddFaq}>
        <label>Question<input name="question" required /></label>
        <label>Answer<textarea name="answer" rows={2} required /></label>
        <button className="primary" type="submit">Add FAQ</button>
      </form>
      <div className="list">
        {faq.map((item) => (
          <div className="list-item" key={item.id}>
            <strong>{item.question}</strong>
            <p>{item.answer}</p>
            <button className="danger" type="button" onClick={() => deleteFaq(item.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
