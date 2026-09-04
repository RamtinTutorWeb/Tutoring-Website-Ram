import { SignIn } from "@clerk/react";
import { isClerkConfigured } from "../config";
import { MockAuthForm } from "./MockAuthForm";

export function SignInPage() {
  if (!isClerkConfigured) {
    return (
      <MockAuthForm
        title="Sign in"
        submitLabel="Sign in"
        alternate={{ text: "No account?", to: "/sign-up", label: "Sign up" }}
      />
    );
  }

  return (
    <section className="page auth-single-wrap">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </section>
  );
}

export default SignInPage;
