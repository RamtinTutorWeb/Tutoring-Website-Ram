import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMockAuth } from "./MockAuthProvider";
import { AUTH_ROLES, toAuthRole, type AuthRole } from "./types";

interface MockAuthFormProps {
  title: string;
  submitLabel: string;
  alternate: { text: string; to: string; label: string };
}

/** Dev-only stand-in for Clerk's <SignIn /> / <SignUp /> when no key is configured. */
export function MockAuthForm({ title, submitLabel, alternate }: MockAuthFormProps) {
  const { user, signIn } = useMockAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<AuthRole>("student");

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    if (!email) return;
    signIn(email, role);
    navigate("/dashboard", { replace: true });
  }

  return (
    <section className="page auth-single-wrap">
      <form className="card auth-single-card" onSubmit={handleSubmit} autoComplete="off">
        <h3>{title}</h3>
        <p className="muted">
          Dev mock auth. Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> to use real Clerk sign-in.
        </p>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Role
          <select name="role" value={role} onChange={(e) => setRole(toAuthRole(e.target.value))}>
            {AUTH_ROLES.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" type="submit">
          {submitLabel}
        </button>
        <p className="muted auth-link-row">
          {alternate.text} <Link to={alternate.to}>{alternate.label}</Link>
        </p>
      </form>
    </section>
  );
}
