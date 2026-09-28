/** Inline loading / error line for API-backed sections. Renders nothing once loaded. */
export default function LoadState({
  loading,
  error,
  onRetry
}: {
  loading: boolean;
  error: string;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <p className="feedback error" role="alert">
        {error}{" "}
        {onRetry ? <button type="button" className="inline-action" onClick={onRetry}>Retry</button> : null}
      </p>
    );
  }
  if (loading) return <p className="muted">Loading...</p>;
  return null;
}
