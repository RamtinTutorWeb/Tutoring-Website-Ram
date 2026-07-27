import { FormEvent, useMemo, useState } from "react";
import PasswordField from "../components/PasswordField";
import StarRating from "../components/StarRating";
import { useAppContext } from "../context/AppContext";
import type { Course, CourseProgressStatus, FaqItem, Review, SelectableOptionKey, SessionSettings, SessionSlot, SessionSlotStatus, User } from "../types";

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

const learnerRoles: User["role"][] = ["student", "parent"];
const calendlyUrl = "https://calendly.com/shahla-ca78/30min";

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
    createTutor,
    resetLearnerAccount,
    addReview,
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
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "tutor")) return;
    const fd = new FormData(e.currentTarget);
    addReview(String(fd.get("name") ?? ""), Number(fd.get("rating") ?? 5), String(fd.get("text") ?? ""));
    e.currentTarget.reset();
  }

  function handleAddFaq(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const fd = new FormData(e.currentTarget);
    addFaq(String(fd.get("question") ?? ""), String(fd.get("answer") ?? ""));
    e.currentTarget.reset();
  }

  async function handleAddTutor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const fd = new FormData(e.currentTarget);
    const result = await createTutor({
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? "")
    });
    setAdminFeedback(result.message);
    if (result.ok) e.currentTarget.reset();
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
        />
      ) : null}

      {currentUser.role === "tutor" ? (
        <TutorDashboard
          currentUser={currentUser}
          requests={db.requests}
          courses={db.courses}
          reviews={db.reviews}
          sessionSlots={db.sessionSlots}
          sessionSettings={db.sessionSettings}
          tutors={tutors}
          updateRequestStatus={updateRequestStatus}
          addSessionSlot={addSessionSlot}
          updateSessionSlotStatus={updateSessionSlotStatus}
          reserveSessionSlot={reserveSessionSlot}
          deleteSessionSlot={deleteSessionSlot}
          updateSessionSettings={updateSessionSettings}
        />
      ) : null}

      {currentUser.role === "admin" ? (
        <div className="dashboard-stack" id="admin-dashboard">
          <div className="dashboard-grid">
            <StatCard label="Learners" value={learners.length} />
            <StatCard label="Tutors" value={tutors.length} />
            <StatCard label="Courses" value={db.courses.length} />
            <StatCard label="Open Requests" value={db.requests.filter((request) => request.status !== "closed").length} />
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Add Tutor</h3>
              <form onSubmit={handleAddTutor}>
                <label>Name<input name="name" required /></label>
                <label>Email<input name="email" type="email" required /></label>
                <PasswordField label="Temporary Password" name="password" minLength={8} required />
                <button className="primary" type="submit">Create Tutor</button>
              </form>
            </div>

            <div className="card">
              <h3>Reset Learner Account</h3>
              <form onSubmit={handleResetLearner}>
                <label>Learner Email<input name="email" type="email" required /></label>
                <button className="primary" type="submit">Send Reset Link</button>
              </form>
              <p className="feedback">{adminFeedback}</p>
            </div>
          </div>

          <div className="grid-2">
            <ManageCoursesCard
              courses={db.courses}
              courseCategories={db.selectableOptions.courseCategories}
              onAdd={handleAddCourse}
              onDelete={deleteCourse}
            />

            <div className="card">
              <h3>Assign Course To Learner</h3>
              <form onSubmit={handleAssignCourse}>
                <label>Learner
                  <select name="userId" required>
                    <option value="">Select learner</option>
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

          <div className="card">
            <h3>Learner Course Progress</h3>
            <p className="muted">For full notes and learner needs, check the Detail Request tab.</p>
            <div className="list">
              {db.learnerCourses.length ? db.learnerCourses.map((record) => {
                const learner = getUser(record.userId);
                const course = getCourse(record.courseId);
                return (
                  <div className="list-item learner-course-row" key={record.id}>
                    <div>
                      <strong>{learner?.name ?? "Unknown learner"}</strong>
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
              }) : <p className="muted">No learner courses assigned yet.</p>}
            </div>
          </div>

          <RequestsCard requests={db.requests} updateRequestStatus={updateRequestStatus} />

          <div className="grid-2">
            <ReviewsCard reviews={db.reviews} handleAddReview={handleAddReview} deleteReview={deleteReview} />
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
  return (
    <div className="dashboard-hero">
      <div>
        <p className="hero-kicker">{currentUser.role} portal</p>
        <h2>{currentUser.name}</h2>
        <p>{currentUser.email}</p>
      </div>
      <span className="role-pill">{currentUser.role}</span>
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
  reserveSessionSlot
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
  addSessionSlot: (slot: Omit<SessionSlot, "id">) => void;
  reserveSessionSlot: (slotId: string, learnerName: string, notes?: string) => void;
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
            <p><strong>Role:</strong> {currentUser.role}</p>
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

      <SessionCalendarCard
        currentUser={currentUser}
        tutors={tutors}
        sessionSlots={sessionSlots}
        sessionSettings={sessionSettings}
        addSessionSlot={addSessionSlot}
        reserveSessionSlot={reserveSessionSlot}
      />

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
  addSessionSlot: (slot: Omit<SessionSlot, "id">) => void;
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
  addSessionSlot?: (slot: Omit<SessionSlot, "id">) => void;
  updateSessionSlotStatus?: (slotId: string, status: SessionSlotStatus) => void;
  reserveSessionSlot: (slotId: string, learnerName: string, notes?: string) => void;
  deleteSessionSlot?: (slotId: string) => void;
  updateSessionSettings?: (settings: SessionSettings) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [defaultAvailableDate, setDefaultAvailableDate] = useState("");
  const [addingSlot, setAddingSlot] = useState(false);
  const isAdmin = currentUser.role === "admin";
  const isTutor = currentUser.role === "tutor";
  const canManageSlots = isAdmin || isTutor;
  const visibleSlots = sessionSlots
    .filter((slot) => isAdmin || !isTutor || slot.tutorId === currentUser.id)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const selectedDateSlots = visibleSlots.filter((slot) => slot.date === selectedDate);
  const selectedSlot = selectedSlotId ? visibleSlots.find((slot) => slot.id === selectedSlotId) : undefined;
  const calendarDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });

  function handleAddSlot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addSessionSlot || !canManageSlots) return;
    const fd = new FormData(e.currentTarget);
    addSessionSlot({
      tutorId: isAdmin ? String(fd.get("tutorId") ?? "") : currentUser.id,
      date: String(fd.get("date") ?? selectedDate),
      startTime: String(fd.get("startTime") ?? ""),
      endTime: String(fd.get("endTime") ?? ""),
      status: String(fd.get("status") ?? "available") as SessionSlotStatus,
      learnerName: String(fd.get("learnerName") ?? "").trim(),
      notes: String(fd.get("notes") ?? "").trim()
    });
    e.currentTarget.reset();
    setAddingSlot(false);
    setSelectedSlotId("");
    setSelectedDate(String(fd.get("date") ?? selectedDate));
  }

  function tutorName(tutorId: string): string {
    return tutors.find((tutor) => tutor.id === tutorId)?.name ?? (tutorId === currentUser.id ? currentUser.name : "Tutor");
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
    const slots = visibleSlots.filter((slot) => slot.date === date);
    const firstAvailable = slots.find((slot) => getSlotStatus(slot) === "available");
    const firstReserved = slots.find((slot) => getSlotStatus(slot) === "reserved");

    setSelectedDate(date);
    setAddingSlot(false);
    setDefaultAvailableDate("");

    if (canManageSlots) {
      if (firstReserved && !firstAvailable) {
        setSelectedSlotId(firstReserved.id);
        return;
      }
      if (firstAvailable) {
        setSelectedSlotId(firstAvailable.id);
        return;
      }
      setAddingSlot(true);
      return;
    }

    if (firstAvailable) {
      setSelectedSlotId(firstAvailable.id);
      return;
    }

    setDefaultAvailableDate(date);
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
    setDefaultAvailableDate("");
    setAddingSlot(false);
  }

  function handleDefaultReservation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addSessionSlot) return;
    const fd = new FormData(e.currentTarget);
    addSessionSlot({
      tutorId: tutors[0]?.id ?? currentUser.id,
      date: defaultAvailableDate,
      startTime: String(fd.get("startTime") ?? ""),
      endTime: String(fd.get("endTime") ?? "") || calculateEndTime(String(fd.get("startTime") ?? "")),
      status: "reserved",
      learnerName: String(fd.get("learnerName") ?? currentUser.name).trim() || currentUser.name,
      notes: String(fd.get("notes") ?? "").trim()
    });
    closeDetails();
  }

  function calculateEndTime(startTime: string): string {
    if (!startTime) return "";
    const [hours, minutes] = startTime.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes + sessionSettings.slotDurationMinutes, 0, 0);
    return date.toTimeString().slice(0, 5);
  }

  function handleSessionSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!updateSessionSettings) return;
    const fd = new FormData(e.currentTarget);
    updateSessionSettings({
      defaultDailySlots: Number(fd.get("defaultDailySlots") ?? sessionSettings.defaultDailySlots),
      slotDurationMinutes: Number(fd.get("slotDurationMinutes") ?? sessionSettings.slotDurationMinutes)
    });
  }

  if (defaultAvailableDate) {
    return (
      <div className="session-modal-backdrop">
        <div className="card session-modal">
          <h3>Available Day</h3>
          <p className="muted">{defaultAvailableDate} is available by default. Choose your preferred time to reserve it.</p>
          <form onSubmit={handleDefaultReservation}>
            <label>Your Name<input name="learnerName" defaultValue={currentUser.name} required /></label>
            <label>Start Time<input name="startTime" type="time" required /></label>
            <label>End Time<input name="endTime" type="time" /></label>
            <p className="muted">Default slot duration is {sessionSettings.slotDurationMinutes} minutes.</p>
            <label>Reservation Notes<textarea name="notes" rows={2} placeholder="Subject, goal, or timing note" /></label>
            <div className="row">
              <button className="primary" type="submit">Save Reservation</button>
              <button type="button" onClick={closeDetails}>Back To Calendar</button>
            </div>
          </form>
          <p>
            <a className="inline-action" href={calendlyUrl} target="_blank" rel="noreferrer">
              Open Calendly Booking Page
            </a>
          </p>
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
          <div className={`calendar-slot ${selectedStatus}`}>
            <div>
              <strong>{tutorName(selectedSlot.tutorId)}</strong>
              <p>Status: {selectedStatus}</p>
              {selectedSlot.learnerName ? <p>Learner: {selectedSlot.learnerName}</p> : null}
              {selectedSlot.notes ? <p>{selectedSlot.notes}</p> : null}
            </div>
          </div>
          {selectedStatus === "available" && !canManageSlots ? (
            <form onSubmit={(e) => handleReserveSlot(e, selectedSlot)}>
              <label>Your Name<input name="learnerName" defaultValue={currentUser.name} required /></label>
              <label>Reservation Notes<textarea name="notes" rows={2} placeholder="Subject, goal, or timing note" /></label>
              <button className="primary" type="submit">Save Reservation</button>
            </form>
          ) : null}
          <p>
            <a className="inline-action" href={calendlyUrl} target="_blank" rel="noreferrer">
              Open Calendly Booking Page
            </a>
          </p>
          <div className="row">
            {canManageSlots && updateSessionSlotStatus ? (
              <button className="primary" type="button" onClick={() => {
                updateSessionSlotStatus(selectedSlot.id, selectedStatus === "reserved" ? "available" : "reserved");
                closeDetails();
              }}>
                {selectedStatus === "reserved" ? "Make Available" : "Make Reserved"}
              </button>
            ) : null}
            {canManageSlots && deleteSessionSlot ? (
              <button className="danger" type="button" onClick={() => {
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
    return (
      <div className="card">
        <h3>Add Session Slot</h3>
        <form onSubmit={handleAddSlot}>
          {isAdmin ? (
            <label>Tutor
              <select name="tutorId" required>
                <option value="">Select tutor</option>
                {tutors.map((tutor) => (
                  <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label>Date<input name="date" type="date" defaultValue={selectedDate} required /></label>
          <label>Start Time<input name="startTime" type="time" required /></label>
          <label>End Time<input name="endTime" type="time" required /></label>
          <label>Status
            <select name="status" defaultValue="available">
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
            </select>
          </label>
          <label>Learner Name<input name="learnerName" /></label>
          <label>Notes<textarea name="notes" rows={2} /></label>
          <div className="row">
            <button className="primary" type="submit">Save Slot</button>
            <button type="button" onClick={closeDetails}>Back To Calendar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Session Calendar</h3>
      <p className="muted">Each day has {sessionSettings.defaultDailySlots} slots by default. Each slot is {sessionSettings.slotDurationMinutes} minutes.</p>
      <p>
        <a className="inline-action" href={calendlyUrl} target="_blank" rel="noreferrer">
          Open Calendly Booking Page
        </a>
      </p>

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
          <label>Slots Per Day<input name="defaultDailySlots" type="number" min={1} defaultValue={sessionSettings.defaultDailySlots} required /></label>
          <label>Slot Duration Minutes<input name="slotDurationMinutes" type="number" min={15} step={15} defaultValue={sessionSettings.slotDurationMinutes} required /></label>
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
            <span>{tutorName(slot.tutorId)} | {getSlotStatus(slot)}</span>
          </button>
        )) : (
          <p className="muted">No slots for this date.</p>
        )}
      </div>

      {canManageSlots ? (
        <button className="primary" type="button" onClick={() => setAddingSlot(true)}>Add Slot</button>
      ) : null}
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
          <div className="list-item" key={course.id}>
            <strong>{course.title}</strong> <span className="muted">({course.category})</span>
            <p>{course.description}</p>
            <button className="danger" type="button" onClick={() => onDelete(course.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsCard({
  reviews,
  handleAddReview,
  deleteReview
}: {
  reviews: Review[];
  handleAddReview: (e: FormEvent<HTMLFormElement>) => void;
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
            <p>{review.text}</p>
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
