import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PasswordField from "../components/PasswordField";
import { useAppContext } from "../context/AppContext";
import type { User } from "../types";

export default function AuthPage() {
  const { currentUser, login, signup } = useAppContext();
  const navigate = useNavigate();
  const [loginFeedback, setLoginFeedback] = useState("");
  const [signupFeedback, setSignupFeedback] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const loginPasswordRef = useRef<HTMLInputElement>(null);
  const signupPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const clearPasswords = () => {
      if (loginPasswordRef.current) loginPasswordRef.current.value = "";
      if (signupPasswordRef.current) signupPasswordRef.current.value = "";
    };

    clearPasswords();
    const timer = window.setTimeout(clearPasswords, 300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentUser) {
      navigate("/dashboard", { replace: true });
    }
  }, [currentUser, navigate]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoginLoading(true);
    try {
      const result = await login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
      setLoginFeedback(result.message);
      if (result.ok) {
        e.currentTarget.reset();
        navigate("/dashboard", { replace: true });
      }
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSignupLoading(true);
    try {
      const result = await signup({
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
        role: String(fd.get("role") ?? "student") as User["role"]
      });

      setSignupFeedback(result.message);
      if (result.ok) {
        e.currentTarget.reset();
        navigate("/dashboard", { replace: true });
      }
    } finally {
      setSignupLoading(false);
    }
  }

  return (
    <section data-page="login" className="page">
      <h2>Login / Signup</h2>
      <div className="grid-2">
        <form id="login-form" className="card" onSubmit={handleLogin} autoComplete="off">
          <h3>Login with Email</h3>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <PasswordField label="Password" name="password" inputRef={loginPasswordRef} required />
          <button className="primary" type="submit" disabled={loginLoading}>{loginLoading ? "Logging in..." : "Login"}</button>
          <p className="muted auth-link-row"><Link to="/forgot-password">Forgot your password?</Link></p>
          <p className="feedback">{loginFeedback}</p>
        </form>

        <form id="signup-form" className="card" onSubmit={handleSignup} autoComplete="off">
          <h3>Create Account</h3>
          <label>Name<input name="name" autoComplete="name" required /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <PasswordField label="Password" name="password" inputRef={signupPasswordRef} required />
          <label>Role
            <select name="role" required>
              <option value="student">Student</option>
              <option value="parent">Parent</option>
              <option value="tutor">Tutor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="primary" type="submit" disabled={signupLoading}>{signupLoading ? "Creating..." : "Create Account"}</button>
          <p className="feedback">{signupFeedback}</p>
        </form>
      </div>

      <div className="card">
        <h3>Additional Auth (Planned)</h3>
        <p>Google login and forgot-password email flow are future integrations.</p>
      </div>
    </section>
  );
}
