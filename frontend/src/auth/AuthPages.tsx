import { SignIn, SignUp } from "@clerk/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthNotConfigured } from "./guards";
import { useSession } from "./session";

/** Local dev only: pick a seeded user instead of signing in with Clerk. */
function DevSignIn() {
  const { devSignIn } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect_url");
  const target = redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/dashboard";

  function signIn(userId: string) {
    devSignIn?.(userId);
    navigate(target, { replace: true });
  }

  return (
    <section className="page auth-single-wrap">
      <div className="card dev-signin">
        <p className="eyebrow">Local development</p>
        <h3>Sign in as a test user</h3>
        <p className="muted">Clerk isn't configured, so DEV_AUTH sign-in is on. This screen never appears in production builds.</p>
        <div className="row">
          <button className="primary" type="button" onClick={() => signIn("user_dev_admin")}>Tutor (admin)</button>
          <button type="button" onClick={() => signIn("user_dev_student")}>Student</button>
          <button type="button" onClick={() => signIn("user_dev_new_student")}>New student</button>
        </div>
      </div>
    </section>
  );
}

export function SignInPage() {
  const { configured, mode } = useSession();
  if (import.meta.env.DEV && mode === "dev") return <DevSignIn />;
  if (!configured) return <AuthNotConfigured />;

  return (
    <section className="page auth-single-wrap">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </section>
  );
}

export function SignUpPage() {
  const { configured, mode } = useSession();
  if (import.meta.env.DEV && mode === "dev") return <DevSignIn />;
  if (!configured) return <AuthNotConfigured />;

  return (
    <section className="page auth-single-wrap">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />
    </section>
  );
}
