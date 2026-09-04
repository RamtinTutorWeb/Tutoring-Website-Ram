import { UserButton } from "@clerk/react";
import { isClerkConfigured } from "../config";
import { useAuthUser } from "./useAuthUser";

/**
 * Header-ready account control. Clerk mode renders Clerk's <UserButton />;
 * mock mode shows email + role badge + sign out. Not wired into the nav yet.
 */
export function UserMenu() {
  const { isLoaded, isSignedIn, email, role, signOut } = useAuthUser();

  if (!isLoaded || !isSignedIn) return null;

  if (isClerkConfigured) {
    return <UserButton />;
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <span className="muted">{email}</span>
      {role ? <span className="role-pill">{role}</span> : null}
      <button type="button" onClick={() => void signOut()} style={{ marginTop: 0 }}>
        Sign out
      </button>
    </span>
  );
}

export default UserMenu;
