import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useMe } from "../api/MeProvider";
import { useSession } from "../auth/session";

export default function ProfilePage() {
  const { me, loading, error, refetch, update } = useMe();
  const { signOut, openUserProfile } = useSession();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await update({
        fullName: String(fd.get("fullName") ?? "").trim(),
        phone: String(fd.get("phone") ?? "").trim()
      });
      setFeedback({ text: "Profile updated.", error: false });
    } catch (err) {
      setFeedback({ text: errorMessage(err, "Could not update your profile."), error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section data-page="profile" className="page profile-page">
      <div className="profile-page-heading">
        <p className="hero-kicker">Account</p>
        <h2>Profile</h2>
        <p>Manage your personal and account information.</p>
      </div>
      {loading ? <p className="muted">Loading...</p> : null}
      {error ? (
        <div className="card" role="alert">
          <p className="feedback error">Could not load your profile: {error}</p>
          <button type="button" onClick={() => void refetch()}>Retry</button>
        </div>
      ) : null}
      {me ? (
        <div className="card profile-page-card">
          <h3>Personal Information</h3>
          <div className="profile-lines">
            <p><strong>Name:</strong> {me.fullName || "Not provided"}</p>
            <p><strong>Email:</strong> {me.email}</p>
            <p><strong>Phone:</strong> {me.phone || "Not provided"}</p>
            <p><strong>Account type:</strong> {me.role === "admin" ? "Admin" : "Student"}</p>
          </div>
          <form className="profile-phone-form" onSubmit={handleSubmit}>
            <label>Full Name
              <input name="fullName" defaultValue={me.fullName ?? ""} autoComplete="name" />
            </label>
            <label>Phone Number
              <input name="phone" type="tel" defaultValue={me.phone ?? ""} placeholder="+1 555 123 4567" autoComplete="tel" />
            </label>
            <button className="primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
            <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p>
          </form>
          <div className="profile-security">
            <h3>Account Security</h3>
            <p>Change your email, password, or sign-in methods, or sign out.</p>
          </div>
          <div className="row">
            <button className="profile-password-link" type="button" onClick={openUserProfile}>Manage Account</button>
            <button className="danger" type="button" onClick={() => void signOut().then(() => navigate("/"))}>Sign Out</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
