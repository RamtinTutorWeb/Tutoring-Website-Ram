import { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "../clients/apiClient";
import PasswordField from "../components/PasswordField";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get("email");
  const token = searchParams.get("token");
  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  // Some clients decode "+" in query params as spaces; restore for non-URL-safe tokens.
  const normalizedToken = token?.replace(/ /g, "+") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (!normalizedEmail || !normalizedToken) {
    return (
      <section className="page auth-single-wrap">
        <div className="card auth-single-card">
          <h2>Reset Password</h2>
          <p className="feedback error">Invalid or expired reset link.</p>
          <p className="muted auth-link-row">
            Back to <Link to="/login">Login</Link>
          </p>
        </div>
      </section>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setError("");
      setLoading(true);

      await apiClient.post("/users/reset-password", {
        email: normalizedEmail,
        token: normalizedToken,
        newPassword: password,
      });

      setSuccess("Password reset successful! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page auth-single-wrap">
      <div className="card auth-single-card">
        <h2>Reset your password</h2>
        <p className="muted">Enter a new password for <strong>{normalizedEmail}</strong>.</p>

        {error ? <p className="feedback error">{error}</p> : null}
        {success ? <p className="feedback ok">{success}</p> : null}

        <form onSubmit={handleSubmit}>
          <PasswordField label="New Password" value={password} onChange={setPassword} required />
          <PasswordField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} required />

          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </section>
  );
}
