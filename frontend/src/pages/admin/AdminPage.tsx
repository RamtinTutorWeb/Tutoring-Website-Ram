import type { ReactNode } from "react";
import { Navigate, NavLink, useParams } from "react-router-dom";
import { useContent } from "../../api/ContentProvider";
import { useMe } from "../../api/MeProvider";
import LoadState from "../../components/LoadState";
import DashboardHeader from "../dashboard/DashboardHeader";
import { AdminOverview, AdminStudents } from "./AdminSections";
import { CourseCatalogEditor, ExamTrackEditor, FaqEditor, OptionsEditor, ReviewsEditor } from "./editors";
import { PageEditor } from "./PageEditor";

interface Tab {
  id: string;
  label: string;
  group: string;
  title: string;
  description: string;
  render: () => ReactNode;
}

const tabs: Tab[] = [
  {
    id: "overview",
    label: "Overview",
    group: "Manage",
    title: "Overview",
    description: "New requests, upcoming sessions, and anything waiting on you.",
    render: () => <AdminOverview />
  },
  {
    id: "students",
    label: "Students",
    group: "Manage",
    title: "Students",
    description: "Student accounts and course progress.",
    render: () => <AdminStudents />
  },
  {
    id: "home",
    label: "Home page",
    group: "Website",
    title: "Home page",
    description: "The headline, teaching style, sample video, and FAQ on the home page.",
    render: () => (
      <>
        <PageEditor
          page="home"
          title="Headline and teaching style"
          fields={[
            { name: "kicker", label: "Small line above the headline" },
            { name: "title", label: "Headline" },
            { name: "subtitle", label: "Sub-headline", type: "textarea", rows: 2 },
            { name: "teachingTitle", label: "Teaching style heading" },
            { name: "teachingText", label: "Teaching style text", type: "textarea", rows: 5, hint: "Leave a blank line between paragraphs." },
            {
              name: "videoUrl",
              label: "Sample video link",
              type: "url",
              placeholder: "https://www.youtube.com/watch?v=...",
              hint: "A YouTube or Vimeo link, or a direct link to an .mp4 file. Leave empty to hide the video."
            }
          ]}
        />
        <FaqEditor />
      </>
    )
  },
  {
    id: "about",
    label: "About me",
    group: "Website",
    title: "About me",
    description: "Your education, teaching style, and experience.",
    render: () => (
      <PageEditor
        page="about"
        title="About page"
        fields={[
          { name: "title", label: "Page title" },
          { name: "intro", label: "Introduction", type: "textarea", rows: 3 },
          { name: "photoUrl", label: "Photo link", type: "url", placeholder: "https://...", hint: "Optional. A link to a photo of you (https)." }
        ]}
        sectionsLabel="Sections"
      />
    )
  },
  {
    id: "courses",
    label: "Courses",
    group: "Website",
    title: "Courses",
    description: "Courses listed on the Courses page. Anything in the \"Exam Prep\" category also shows on the Exam Prep page.",
    render: () => (
      <>
        <CourseCatalogEditor />
        <OptionsEditor title="Course categories" groups={["courseCategories"]} />
      </>
    )
  },
  {
    id: "exam-prep",
    label: "Exam prep",
    group: "Website",
    title: "Exam prep",
    description: "What you help with for exams, and the exam timelines you can work with.",
    render: () => (
      <>
        <PageEditor
          page="examPrep"
          title="Page text"
          fields={[
            { name: "intro", label: "Introduction", type: "textarea", rows: 3 },
            { name: "timelinesTitle", label: "Exam timelines heading" },
            { name: "timelinesText", label: "Exam timelines text", type: "textarea", rows: 3 }
          ]}
        />
        <ExamTrackEditor />
        <OptionsEditor
          title="Exam timelines"
          description="Shown on the Exam Prep page and offered as “Upcoming exam” on the contact form."
          groups={["urgencyWindows"]}
        />
      </>
    )
  },
  {
    id: "reviews",
    label: "Reviews",
    group: "Website",
    title: "Reviews",
    description: "Approve student reviews or add your own.",
    render: () => <ReviewsEditor />
  },
  {
    id: "policy",
    label: "Policy",
    group: "Website",
    title: "Policy",
    description: "Cancellation, payment, and any other policies.",
    render: () => (
      <PageEditor
        page="policy"
        title="Policy page"
        fields={[{ name: "intro", label: "Introduction (optional)", type: "textarea", rows: 2 }]}
        sectionsLabel="Policy sections"
      />
    )
  },
  {
    id: "contact",
    label: "Contact & booking",
    group: "Website",
    title: "Contact & booking",
    description: "Your contact details, Calendly booking link, and contact form choices.",
    render: () => (
      <>
        <PageEditor
          page="booking"
          title="Booking (Calendly)"
          description="The scheduler on the Book page. Paste the link of your own Calendly event type (Calendly → Event types → Copy link)."
          fields={[
            { name: "calendlyUrl", label: "Calendly event link", type: "url", placeholder: "https://calendly.com/your-name/tutoring-session" },
            { name: "intro", label: "Text above the scheduler", type: "textarea", rows: 2 }
          ]}
        />
        <PageEditor
          page="contact"
          title="Contact details"
          fields={[
            { name: "intro", label: "Text above the contact form", type: "textarea", rows: 2 },
            { name: "email", label: "Public email", type: "email", hint: "Shown on the contact page and footer. Leave empty to hide." },
            { name: "phone", label: "Public phone", type: "tel", hint: "Leave empty to hide." }
          ]}
        />
        <OptionsEditor
          title="Contact form choices"
          groups={["contactMethods", "serviceTypes", "assessmentSubjects"]}
        />
      </>
    )
  }
];

export default function AdminPage() {
  const { tab: tabId } = useParams();
  const { me } = useMe();
  const { loaded, loading, error, refetch } = useContent();
  const tab = tabs.find((item) => item.id === (tabId ?? "overview"));
  if (!tab) return <Navigate to="/admin" replace />;

  let lastGroup = "";
  return (
    <section data-page="admin" className="page dashboard-page">
      <DashboardHeader me={me} heading="Admin dashboard" />
      <div className="admin-layout">
        <nav className="card admin-nav" aria-label="Admin sections">
          {tabs.map((item) => {
            const groupLabel = item.group !== lastGroup ? item.group : "";
            lastGroup = item.group;
            return (
              <span key={item.id} style={{ display: "contents" }}>
                {groupLabel ? <span className="admin-nav-group">{groupLabel}</span> : null}
                <NavLink to={`/admin/${item.id}`} className={({ isActive }) => (isActive || (!tabId && item.id === "overview") ? "active" : "")}>
                  {item.label}
                </NavLink>
              </span>
            );
          })}
        </nav>
        <div className="admin-content">
          <div className="admin-title">
            <h2>{tab.title}</h2>
            <p className="muted">{tab.description}</p>
          </div>
          <LoadState loading={loading && !loaded} error={error} onRetry={() => void refetch()} />
          {/* Editors start from the saved content, so wait for it instead of editing defaults. */}
          {loaded ? tab.render() : null}
        </div>
      </div>
    </section>
  );
}
