export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString();
}
