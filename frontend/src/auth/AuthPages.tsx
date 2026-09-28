import { SignIn, SignUp } from "@clerk/react";
import { AuthNotConfigured } from "./guards";
import { useSession } from "./session";

export function SignInPage() {
  const { configured } = useSession();
  if (!configured) return <AuthNotConfigured />;

  return (
    <section className="page auth-single-wrap">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </section>
  );
}

export function SignUpPage() {
  const { configured } = useSession();
  if (!configured) return <AuthNotConfigured />;

  return (
    <section className="page auth-single-wrap">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />
    </section>
  );
}
