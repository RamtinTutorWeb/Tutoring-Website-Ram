import { SignUp } from "@clerk/react";
import { isClerkConfigured } from "../config";
import { MockAuthForm } from "./MockAuthForm";

export function SignUpPage() {
  if (!isClerkConfigured) {
    return (
      <MockAuthForm
        title="Create account"
        submitLabel="Create account"
        alternate={{ text: "Already have an account?", to: "/sign-in", label: "Sign in" }}
      />
    );
  }

  return (
    <section className="page auth-single-wrap">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </section>
  );
}

export default SignUpPage;
