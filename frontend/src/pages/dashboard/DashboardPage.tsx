import { useMe } from "../../api/MeProvider";
import AdminDashboard from "./AdminDashboard";
import DashboardHeader from "./DashboardHeader";
import StudentDashboard from "./StudentDashboard";

export default function DashboardPage() {
  const { me, loading, error, isAdmin, refetch } = useMe();

  return (
    <section data-page="dashboard" className="page dashboard-page">
      {loading ? <p className="muted">Loading...</p> : null}
      {error ? (
        <div className="card" role="alert">
          <p className="feedback error">Could not load your account: {error}</p>
          <button type="button" onClick={() => void refetch()}>Retry</button>
        </div>
      ) : null}
      {me ? (
        <>
          <DashboardHeader me={me} />
          {isAdmin ? <AdminDashboard /> : <StudentDashboard />}
        </>
      ) : null}
    </section>
  );
}
