import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthUser } from "./useAuthUser";
import type { AuthRole } from "./types";

interface ProtectedRouteProps {
  /** When set, signed-in users without this role are sent to `/`. */
  requireRole?: Extract<AuthRole, "admin">;
}

/**
 * Layout route guard. Usage:
 *   <Route element={<ProtectedRoute />}><Route path="/x" element={...} /></Route>
 * Waits for the auth provider to load, then redirects unauthenticated users
 * to `/sign-in` (remembering where they came from) and role mismatches to `/`.
 */
export function ProtectedRoute({ requireRole }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn, role } = useAuthUser();
  const location = useLocation();

  if (!isLoaded) {
    return <p className="muted">Loading...</p>;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  }

  if (requireRole && role !== requireRole) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
