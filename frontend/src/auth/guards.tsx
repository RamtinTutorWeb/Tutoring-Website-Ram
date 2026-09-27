import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMe } from "../api/MeProvider";
import { useSession } from "./session";

export function AuthNotConfigured() {
  return (
    <section className="page auth-single-wrap">
      <div className="card" role="alert">
        <h3>Sign-in is not configured</h3>
        <p className="muted">
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in <code>frontend/.env</code> (Clerk dashboard &gt; API keys) and
          restart the dev server or rebuild. Public pages keep working without it.
        </p>
      </div>
    </section>
  );
}

function Loading() {
  return <p className="muted">Loading...</p>;
}

/** Signed-out users are sent to /sign-in and returned here afterwards via Clerk's `redirect_url`. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { configured, isLoaded, isSignedIn } = useSession();
  const location = useLocation();

  if (!configured) return <AuthNotConfigured />;
  if (!isLoaded) return <Loading />;
  if (!isSignedIn) {
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?redirect_url=${redirectUrl}`} replace />;
  }
  return <>{children}</>;
}

/** Role comes from `GET /me`; non-admins are sent to their dashboard. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminGate>{children}</AdminGate>
    </RequireAuth>
  );
}

function AdminGate({ children }: { children: ReactNode }) {
  const { loading, error, isAdmin, refetch } = useMe();

  if (loading) return <Loading />;
  if (error) {
    return (
      <div className="card" role="alert">
        <p className="feedback error">Could not load your account: {error}</p>
        <button type="button" onClick={() => void refetch()}>Retry</button>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
