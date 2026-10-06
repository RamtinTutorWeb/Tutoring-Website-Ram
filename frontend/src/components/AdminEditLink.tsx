import { Link } from "react-router-dom";
import { useMe } from "../api/MeProvider";

/** Floating "Edit this page" shortcut, shown only to admins. Editing itself happens in /admin. */
export default function AdminEditLink({ tab }: { tab: string }) {
  const { isAdmin } = useMe();
  if (!isAdmin) return null;
  return <Link className="button-link primary admin-edit-link" to={`/admin/${tab}`}>Edit this page</Link>;
}
