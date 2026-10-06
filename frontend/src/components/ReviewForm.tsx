import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { ApiError, errorMessage } from "../api/client";
import { useCreateReview } from "../api/hooks";
import { useMe } from "../api/MeProvider";
import { useSession } from "../auth/session";

/** "Leave A Review" card: signed-in students submit via POST /reviews; signed-out visitors get a sign-in prompt. */
export default function ReviewForm() {
  const { isSignedIn } = useSession();
  const { me, isAdmin } = useMe();
  const createReview = useCreateReview();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", error: false });

  if (isAdmin) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    setSubmitting(true);
    try {
      await createReview({
        rating: Number(fd.get("rating") ?? 5),
        text: String(fd.get("text") ?? "").trim(),
        ...(name ? { name } : {})
      });
      setFeedback({ text: "Thanks! Your review will appear after approval.", error: false });
      form.reset();
    } catch (err) {
      const text = err instanceof ApiError && err.status === 429
        ? "You already have reviews waiting for approval. Please try again once they have been reviewed."
        : errorMessage(err, "Could not submit your review.");
      setFeedback({ text, error: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <details className="card courses-overview review-overview">
      <summary>Leave a review</summary>
      {isSignedIn ? (
        <form className="review-overview-content" onSubmit={handleSubmit}>
          <label>Display Name
            <input name="name" defaultValue={me?.fullName ?? ""} placeholder="Name or initials" key={me?.fullName ?? ""} />
          </label>
          <label>Rating
            <select name="rating" defaultValue="5">
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
          </label>
          <label>Review<textarea name="text" rows={3} required /></label>
          <button className="primary" type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit for approval"}</button>
          <p className={`feedback ${feedback.error ? "error" : ""}`} role="status">{feedback.text}</p>
        </form>
      ) : (
        <p className="review-overview-content">
          <Link to={`/sign-in?redirect_url=${encodeURIComponent(location.pathname)}`}>Sign in</Link> to leave a review.
        </p>
      )}
      <p className="muted">Reviews appear on the home page after admin approval.</p>
    </details>
  );
}
