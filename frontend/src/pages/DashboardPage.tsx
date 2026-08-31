import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import StarRating from "../components/StarRating";
import { useAppContext } from "../context/AppContext";
import type { BookingRequest, Course, CourseProgressStatus, FaqItem, Review, SelectableOptionKey, SessionSettings, SessionSlot, SessionSlotStatus, SessionType, User } from "../types";

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

export default function DashboardPage({ adminView = "dashboard" }: { adminView?: "dashboard" | "settings" }) {
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
  const [selectedOptionGroup, setSelectedOptionGroup] = useState<SelectableOptionKey>("contactMethods");
  const [optionFeedback, setOptionFeedback] = useState("");
  const [adminFeedback, setAdminFeedback] = useState("");

  const learners = useMemo(() => db.users.filter((user) => learnerRoles.includes(user.role)), [db.users]);
  const tutors = useMemo(() => db.users.filter((user) => user.role === "tutor"), [db.users]);
  const myRequests = currentUser ? db.requests.filter((request) => request.userId === currentUser.id) : [];
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

  if (adminView === "settings" && currentUser.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <section data-page="dashboard" className="page dashboard-page">
      <DashboardHeader currentUser={currentUser} heading={adminView === "settings" ? "Settings" : undefined} />

      {learnerRoles.includes(currentUser.role) ? (
        <LearnerDashboard
          currentUser={currentUser}
          courseRecords={myCourseRecords}
          courses={db.courses}
          requests={myRequests}
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
          {adminView === "dashboard" ? (
            <>
              <div className="dashboard-grid">
                <StatCard label="Students" value={learners.length} />
                <StatCard label="Courses" value={db.courses.length} />
                <StatCard label="Open Requests" value={db.requests.filter((request) => request.status !== "closed").length} />
              </div>

              <SessionCalendarCard
                currentUser={currentUser}
                tutors={tutors}
                courses={db.courses}
                sessionSlots={db.sessionSlots}
                sessionSettings={db.sessionSettings}
                addSessionSlot={addSessionSlot}
                updateSessionSlotStatus={updateSessionSlotStatus}
                reserveSessionSlot={reserveSessionSlot}
                deleteSessionSlot={deleteSessionSlot}
                updateSessionSettings={updateSessionSettings}
              />
            </>
          ) : (
            <>
          <details className="card courses-overview admin-management">
            <summary>Profile</summary>
            <div className="admin-management-content">
              <div className="profile-lines">
                <p><strong>Name:</strong> {currentUser.name}</p>
                <p><strong>Email:</strong> {currentUser.email}</p>
                <p><strong>Phone:</strong> {currentUser.phone || "Not provided"}</p>
                <p><strong>Account type:</strong> Admin</p>
              </div>
              <Link className="button-link primary" to="/profile">Edit Profile</Link>
            </div>
          </details>

          <div className="admin-course-tools">
            <details className="card courses-overview admin-management">
              <summary>Reset Student Account</summary>
              <div className="admin-management-content">
                <form onSubmit={handleResetLearner}>
                  <label>Student Email<input name="email" type="email" required /></label>
                  <button className="primary" type="submit">Send Reset Link</button>
                </form>
                <p className="feedback">{adminFeedback}</p>
              </div>
            </details>

            <ManageCoursesCard
              courses={db.courses}
              courseCategories={db.selectableOptions.courseCategories}
              onAdd={handleAddCourse}
              onDelete={deleteCourse}
            />

            <details className="card courses-overview admin-management">
              <summary>Assign Course To Student</summary>
              <div className="admin-management-content">
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
            </details>
          </div>

          <details className="card courses-overview admin-management">
            <summary>Student Course Progress</summary>
            <div className="admin-management-content">
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
          </details>

          <RequestsCard requests={db.requests} updateRequestStatus={updateRequestStatus} />

          <details className="card courses-overview admin-management">
            <summary>Manage Student Form Options</summary>
            <div className="admin-management-content">
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
          </details>

          <div className="grid-2">
            <ReviewsCard reviews={db.reviews} handleAddReview={handleAddReview} approveReview={approveReview} deleteReview={deleteReview} />
            <FaqCard faq={db.faq} handleAddFaq={handleAddFaq} deleteFaq={deleteFaq} />
          </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function DashboardHeader({
  currentUser,
  heading
}: {
  currentUser: User;
  heading?: string;
}) {
  const visibleRole = displayRole(currentUser.role);
  return (
    <div className="dashboard-hero">
      <div className="dashboard-hero-main">
        <p className="hero-kicker">{visibleRole} portal</p>
        <h2>{heading ?? currentUser.name}</h2>
        {heading ? <p>{currentUser.name}</p> : null}
      </div>
      {currentUser.role === "admin" ? <span className="role-pill">Admin</span> : null}
    </div>
  );
}

function LearnerDashboard({
  currentUser,
  courseRecords,
  courses,
  requests,
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
  requests: BookingRequest[];
  tutors: User[];
  sessionSlots: SessionSlot[];
  sessionSettings: SessionSettings;
  addSessionSlot: (slot: Omit<SessionSlot, "id">) => { ok: boolean; message: string };
  reserveSessionSlot: (slotId: string, learnerName: string, notes?: string, courseId?: string, courseTitle?: string) => void;
  handleSubmitStudentReview: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const statusCounts = courseRecords.reduce<Record<CourseProgressStatus, number>>(
    (acc, record) => ({ ...acc, [record.status]: acc[record.status] + 1 }),
    { registered: 0, "in-progress": 0, passed: 0 }
  );

  return (
    <div className="dashboard-stack" id="learner-dashboard">
      <details className="card courses-overview">
        <summary>My Courses</summary>
        <div className="dashboard-grid">
          <StatCard label="Registered" value={statusCounts.registered} />
          <StatCard label="In Progress" value={statusCounts["in-progress"]} />
          <StatCard label="Passed" value={statusCounts.passed} />
          <StatCard label="Requests" value={requests.length} />
        </div>
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
      </details>

      <SessionCalendarCard
        currentUser={currentUser}
        tutors={tutors}
        courses={courses}
        sessionSlots={sessionSlots}
        sessionSettings={sessionSettings}
        addSessionSlot={addSessionSlot}
        reserveSessionSlot={reserveSessionSlot}
      />

      <div className="card" id="student-request-history">
        <h3>My Booking Requests</h3>
        {requests.length ? (
          [...requests].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((request) => (
            <details className="list-item request-detail" key={request.id}>
              <summary>
                <strong>{request.subject || request.serviceType}</strong>
                <span className={`request-status status-${request.status}`}>{request.status}</span>
              </summary>
              <div className="request-body">
                <p>{request.message || "No description provided."}</p>
                {request.preferredSlot ? <p><strong>Requested session:</strong> {request.preferredSlot}</p> : null}
                {request.earliestDate ? <p><strong>Date:</strong> {request.earliestDate}</p> : null}
                {request.hardTopics ? <p><strong>Purpose:</strong> {request.hardTopics}</p> : null}
                <p><strong>Submitted:</strong> {new Date(request.createdAt).toLocaleString()}</p>
              </div>
            </details>
          ))
        ) : (
          <p className="muted">No requests yet.</p>
        )}
      </div>

      <details className="card courses-overview review-overview">
        <summary>Leave A Review</summary>
        <form className="review-overview-content" onSubmit={handleSubmitStudentReview}>
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
      </details>

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
  requests: BookingRequest[];
  courses: Course[];
  reviews: Review[];
  sessionSlots: SessionSlot[];
  sessionSettings: SessionSettings;
  tutors: User[];
  updateRequestStatus: (requestId: string, status: "replied" | "closed") => void;
  addSessionSlot: (slot: Omit<SessionSlot, "id">) => { ok: boolean; message: string };
  updateSessionSlotStatus: (slotId: string, status: SessionSlotStatus) => void;
  reserveSessionSlot: (slotId: string, learnerName: string, notes?: string, courseId?: string, courseTitle?: string) => void;
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
        courses={courses}
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
  requests: BookingRequest[];
  updateRequestStatus: (requestId: string, status: "replied" | "closed") => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | BookingRequest["status"]>("all");
  const visibleRequests = [...requests]
    .filter((request) => statusFilter === "all" || request.status === statusFilter)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return (
    <details className="card courses-overview admin-management">
      <summary>Incoming Requests</summary>
      <div className="admin-management-content">
      <div className="request-card-head">
        <label>Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | BookingRequest["status"])}>
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="replied">Replied</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </div>
      {visibleRequests.length ? (
        visibleRequests.map((request) => (
          <details className="list-item request-detail" key={request.id}>
            <summary>
              <strong>{request.subject || request.serviceType}</strong>
              <span className="request-sender">From: {request.name}</span>
              <span className={`request-status status-${request.status}`}>{request.status}</span>
            </summary>
            <div className="request-body">
              <p>{request.message || "No description provided."}</p>
              {request.preferredSlot ? <p><strong>Requested session:</strong> {request.preferredSlot}</p> : null}
              {request.earliestDate ? <p><strong>Date:</strong> {request.earliestDate}</p> : null}
              {request.email ? <p><strong>Email:</strong> {request.email}</p> : null}
              {request.phone ? <p><strong>Phone:</strong> {request.phone}</p> : null}
              {request.hardTopics ? <p><strong>Topics:</strong> {request.hardTopics}</p> : null}
              <p><strong>Submitted:</strong> {new Date(request.createdAt).toLocaleString()}</p>
              <div className="row">
                <button type="button" onClick={() => updateRequestStatus(request.id, "replied")}>Mark Replied</button>
                <button type="button" onClick={() => updateRequestStatus(request.id, "closed")}>Mark Closed</button>
              </div>
            </div>
          </details>
        ))
      ) : (
        <p className="muted">No requests match this status.</p>
      )}
      </div>
    </details>
  );
}

function SessionCalendarCard({
  currentUser,
  tutors,
  courses,
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
  courses: Course[];
  sessionSlots: SessionSlot[];
  sessionSettings: SessionSettings;
  addSessionSlot?: (slot: Omit<SessionSlot, "id">) => { ok: boolean; message: string };
  updateSessionSlotStatus?: (slotId: string, status: SessionSlotStatus) => void;
  reserveSessionSlot: (slotId: string, learnerName: string, notes?: string, courseId?: string, courseTitle?: string) => void;
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
  const [bookingPurpose, setBookingPurpose] = useState("");
  const isAdmin = currentUser.role === "admin";
  const isTutor = false;
  const canManageSlots = isAdmin;
  const activeMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + monthOffset, 1);
  const leadingCalendarDays = activeMonth.getDay();
  const visibleSlots = sessionSlots
    .filter((slot) => isAdmin || !isTutor || slot.tutorId === currentUser.id)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const selectedDateSlots = visibleSlots.filter((slot) => slot.date === selectedDate && getSlotStatus(slot) === "available");
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
      tutorId: tutors[0]?.id ?? currentUser.id,
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
    if (date < today) return;
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
    const courseId = String(fd.get("courseId") ?? "");
    const courseTitle = courses.find((course) => course.id === courseId)?.title ?? "";
    reserveSessionSlot(
      slot.id,
      String(fd.get("learnerName") ?? currentUser.name).trim() || currentUser.name,
      String(fd.get("notes") ?? ""),
      courseId,
      courseTitle
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
    const tutorId = tutors[0]?.id ?? currentUser.id;
    const purpose = String(fd.get("purpose") ?? selectedSessionTypes[0]?.purpose ?? "Tutoring Session");
    const startTime = String(fd.get("startTime") ?? "");
    const courseId = String(fd.get("courseId") ?? "");
    const courseTitle = courses.find((course) => course.id === courseId)?.title ?? "";
    const result = addSessionSlot({
      tutorId,
      date: dayDetailDate,
      startTime,
      endTime: calculateEndTime(startTime, durationForPurpose(purpose)),
      purpose,
      courseId,
      courseTitle,
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
    const initialPurpose = bookingPurpose || selectedSessionTypes[0]?.purpose || "Tutoring Session";
    const activeTutorId = reservableTutors[0]?.id || currentUser.id;
    const availableCount = getDayCounts(dayDetailDate).available;
    const availableStarts = availableStartOptions(dayDetailDate, activeTutorId, initialPurpose);
    const canReserveAnother = availableCount > 0 && availableStarts.length > 0;

    return (
      <div className="session-modal-backdrop">
        <div className="card session-modal">
          <h3>Sessions For {dayDetailDate}</h3>
          <p className="muted">{availableCount} available sessions</p>

          <div>
              <h4>Reserve Available Time</h4>
              {canReserveAnother ? (
                  <form onSubmit={handleDefaultReservation}>
                    <label>Your Name<input name="learnerName" defaultValue={currentUser.name} required /></label>
                    <label>Course
                      <select name="courseId" required>
                        <option value="">Select course</option>
                        {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                      </select>
                    </label>
                    <label>Purpose
                      <select name="purpose" value={initialPurpose} onChange={(e) => setBookingPurpose(e.target.value)} required>
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
                    <button className="primary" type="submit">Request This Session</button>
                  </form>
              ) : (
                <p className="muted">All available sessions for this date are already reserved.</p>
              )}
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
              {selectedSlot.courseTitle ? <p>Course: {selectedSlot.courseTitle}</p> : null}
              <p>Purpose: {selectedSlot.purpose ?? "Tutoring Session"}</p>
              <p>Status: {selectedStatus}</p>
              {selectedSlot.learnerName ? <p>Student: {selectedSlot.learnerName}</p> : null}
              {selectedSlot.notes ? <p>{selectedSlot.notes}</p> : null}
            </div>
          </div>
          {selectedStatus === "available" && !canManageSlots ? (
            <form onSubmit={(e) => handleReserveSlot(e, selectedSlot)}>
              <label>Your Name<input name="learnerName" defaultValue={currentUser.name} required /></label>
              <label>Course
                <select name="courseId" required>
                  <option value="">Select course</option>
                  {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                </select>
              </label>
              <label>Reservation Notes<textarea name="notes" rows={2} placeholder="Subject, goal, or timing note" /></label>
              <button className="primary" type="submit">Request This Session</button>
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
      <h3>Book a Session</h3>
      <p className="muted">Default schedule: {sessionSettings.defaultDailySlots} sessions per day, {formatHour(sessionSettings.dayStartHour)} to {formatHour(sessionSettings.dayEndHour)}. Cancellations lock 24 hours before start.</p>
      <div className="row calendar-nav">
        <button type="button" onClick={() => setMonthOffset((value) => value - 1)}>Previous</button>
        <strong>{activeMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
        <button type="button" onClick={() => setMonthOffset((value) => value + 1)}>Next</button>
      </div>

      <div className="calendar-overview">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span className="calendar-weekday" key={day}>{day}</span>
        ))}
        {Array.from({ length: leadingCalendarDays }, (_, index) => (
          <span className="calendar-day-blank" key={`blank-${index}`} aria-hidden="true" />
        ))}
        {calendarDays.map((date) => {
          const dayAvailability = getDayAvailability(date);
          const isWeekend = [0, 6].includes(new Date(`${date}T00:00:00`).getDay());
          const dayLabel = new Date(`${date}T00:00:00`).getDate();
          return (
            <button
              className={`calendar-day ${dayAvailability.className} ${isWeekend ? "weekend" : ""} ${selectedDate === date ? "active" : ""}`}
              type="button"
              disabled={date < today}
              key={date}
              onClick={() => handleCalendarDayClick(date)}
            >
              <strong>{dayLabel}</strong>
              <span className="calendar-day-status">{dayAvailability.label}</span>
              <span>{dayAvailability.available} available slots</span>
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
        )) : null}
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
    <details className="card courses-overview admin-management">
      <summary>Manage Courses</summary>
      <div className="admin-management-content">
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
    </details>
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
    <details className="card courses-overview admin-management">
      <summary>Manage Reviews</summary>
      <div className="admin-management-content">
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
    </details>
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
    <details className="card courses-overview admin-management">
      <summary>Manage FAQ</summary>
      <div className="admin-management-content">
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
    </details>
  );
}
