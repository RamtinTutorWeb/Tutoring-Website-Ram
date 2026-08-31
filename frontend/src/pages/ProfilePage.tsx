import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

function displayRole(role: "student" | "parent" | "tutor" | "admin"): string {
  if (role === "admin") return "Admin";
  if (role === "tutor") return "Tutor";
  if (role === "parent") return "Parent";
  return "Student";
}

export default function ProfilePage() {
  const { currentUser, logout, updatePhone } = useAppContext();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <section data-page="profile" className="page profile-page">
      <div className="profile-page-heading">
        <p className="hero-kicker">Account</p>
        <h2>Profile</h2>
        <p>Manage your personal and account information.</p>
      </div>
      <div className="card profile-page-card">
        <h3>Personal Information</h3>
        <div className="profile-lines">
          <p><strong>Name:</strong> {currentUser.name}</p>
          <p><strong>Email:</strong> {currentUser.email}</p>
          <p><strong>Phone:</strong> {currentUser.phone || "Not provided"}</p>
          <p><strong>Account type:</strong> {displayRole(currentUser.role)}</p>
        </div>
        <form className="profile-phone-form" onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const phone = String(new FormData(e.currentTarget).get("phone") ?? "");
          setSaving(true);
          const result = await updatePhone(phone);
          setFeedback(result.message);
          setSaving(false);
        }}>
          <label>Phone Number
            <input name="phone" type="tel" defaultValue={currentUser.phone ?? ""} placeholder="+1 555 123 4567" autoComplete="tel" />
          </label>
          <button className="primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Phone Number"}</button>
          <p className="feedback">{feedback}</p>
        </form>
        <div className="profile-security">
          <h3>Account Security</h3>
          <p>Update your password or securely leave your account.</p>
        </div>
        <div className="row">
          <Link className="button-link profile-password-link" to="/forgot-password">Change Password</Link>
          <button className="danger" type="button" onClick={() => {
            logout();
            navigate("/");
          }}>Logout</button>
        </div>
      </div>
    </section>
  );
}
