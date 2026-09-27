import type { Profile } from "../../api/types";

export default function DashboardHeader({ me, heading }: { me: Profile | null; heading?: string }) {
  const isAdmin = me?.role === "admin";
  const name = me?.fullName || me?.email || "";

  return (
    <div className="dashboard-hero">
      <div className="dashboard-hero-main">
        <p className="hero-kicker">{isAdmin ? "Admin" : "Student"} portal</p>
        <h2>{heading ?? (name || "Dashboard")}</h2>
        {heading && name ? <p>{name}</p> : null}
      </div>
      {isAdmin ? <span className="role-pill">Admin</span> : null}
    </div>
  );
}
