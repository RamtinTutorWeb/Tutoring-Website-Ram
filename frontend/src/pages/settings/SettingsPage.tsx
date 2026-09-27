import { Link } from "react-router-dom";
import { useContent } from "../../api/ContentProvider";
import { useMe } from "../../api/MeProvider";
import LoadState from "../../components/LoadState";
import DashboardHeader from "../dashboard/DashboardHeader";
import { allOptionGroups, CourseCatalogEditor, ExamTrackEditor, FaqEditor, OptionsEditor, Panel, ReviewsEditor } from "./editors";

/** Admin-only site content editor (`PUT /content`). */
export default function SettingsPage() {
  const { me } = useMe();
  const { loaded, loading, error, refetch } = useContent();

  return (
    <section data-page="settings" className="page dashboard-page">
      <DashboardHeader me={me} heading="Settings" />
      <LoadState loading={loading} error={error} onRetry={() => void refetch()} />

      {loaded ? (
        <div className="dashboard-stack" id="admin-settings">
          <Panel title="Profile" collapsible>
            <div className="profile-lines">
              <p><strong>Name:</strong> {me?.fullName || "Not provided"}</p>
              <p><strong>Email:</strong> {me?.email}</p>
              <p><strong>Phone:</strong> {me?.phone || "Not provided"}</p>
              <p><strong>Account type:</strong> Admin</p>
            </div>
            <Link className="button-link primary" to="/profile">Edit Profile</Link>
          </Panel>

          <div className="admin-course-tools">
            <CourseCatalogEditor collapsible />
            <ExamTrackEditor collapsible />
          </div>

          <OptionsEditor title="Manage Student Form Options" groups={allOptionGroups} collapsible />

          <div className="grid-2">
            <ReviewsEditor collapsible />
            <FaqEditor collapsible />
          </div>
        </div>
      ) : null}
    </section>
  );
}
