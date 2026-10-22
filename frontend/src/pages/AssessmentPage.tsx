import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useContent } from "../api/ContentProvider";
import { useCreateAssessment } from "../api/hooks";
import { useMe } from "../api/MeProvider";
import { useSession } from "../auth/session";
import LoadState from "../components/LoadState";
import { scoreAssessment } from "../lib/assessment";

interface Result {
  subject: string;
  answers: Array<number | null>;
  score: number;
  total: number;
  recommendation: string;
}

type SaveState = { status: "idle" | "saving" | "saved" | "error"; message: string };

export default function AssessmentPage() {
  const { content, loaded, loading, error, refetch } = useContent();
  const questions = content.assessmentQuestions;
  const { isSignedIn } = useSession();
  const { isAdmin } = useMe();
  const createAssessment = useCreateAssessment();
  const navigate = useNavigate();
  // Indexed like `questions`; missing entries count as unanswered.
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "idle", message: "" });
  const subjects = content.selectableOptions.assessmentSubjects;

  if (isAdmin) {
    return (
      <section data-page="assessment" className="page">
        <h2>Assessment</h2>
        <div className="card" id="assessment-gate">
          <p id="assessment-gate-message">Assessment is available for student accounts.</p>
          <button className="primary" onClick={() => navigate("/dashboard")}>Go To Dashboard</button>
        </div>
      </section>
    );
  }

  async function saveResult(next: Result) {
    setSave({ status: "saving", message: "Saving to your dashboard..." });
    try {
      await createAssessment(next);
      setSave({ status: "saved", message: "Saved to your dashboard." });
    } catch (err) {
      setSave({ status: "error", message: errorMessage(err, "Could not save your result.") });
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const subject = String(new FormData(e.currentTarget).get("subject") ?? "");
    const filled = questions.map((_, index) => answers[index] ?? null);
    const next: Result = { subject, answers: filled, ...scoreAssessment(questions, filled) };
    setResult(next);
    if (isSignedIn) void saveResult(next);
  }

  function restart() {
    setAnswers([]);
    setResult(null);
    setSave({ status: "idle", message: "" });
  }

  return (
    <section data-page="assessment" className="page">
      <div className="page-heading">
        <p className="eyebrow">Free placement check</p>
        <h2>Assessment</h2>
      </div>
      <p className="lead">A quick placement check. It takes about two minutes and helps us recommend where to start.</p>

      <LoadState loading={loading && !loaded} error={error} onRetry={() => void refetch()} />
      {loaded && !questions.length && !result ? (
        <div className="empty-state">The assessment is being updated. <Link to="/contact">Send a request</Link> and we'll find your level together.</div>
      ) : null}
      {result ? (
        <div className="card" id="assessment-result" role="status">
          <h3>Your Result</h3>
          <p><strong>Score:</strong> {result.score} / {result.total}</p>
          <p><strong>Recommended focus:</strong> {result.recommendation}</p>
          {isSignedIn ? (
            <p className={`feedback ${save.status === "error" ? "error" : ""}`}>{save.message}</p>
          ) : (
            <p className="muted"><Link to="/sign-in?redirect_url=%2Fassessment">Sign in</Link> to save results to your dashboard.</p>
          )}
          <div className="row">
            {save.status === "error" ? <button type="button" onClick={() => void saveResult(result)}>Retry Save</button> : null}
            <Link className="button-link primary" to="/contact">Request Tutoring</Link>
            <button type="button" onClick={restart}>Retake</button>
          </div>
        </div>
      ) : questions.length ? (
        <form className="card" id="assessment-form" onSubmit={handleSubmit}>
          <label>Subject
            <select name="subject" required defaultValue="">
              <option value="">Select...</option>
              {subjects.map((subject) => <option key={subject}>{subject}</option>)}
            </select>
          </label>
          {questions.map((question, qIndex) => (
            <fieldset className="list-item" key={question.id}>
              <legend><strong>{qIndex + 1}. {question.text}</strong></legend>
              {question.options.map((option, oIndex) => (
                <label className="check-row" key={`${oIndex}-${option}`}>
                  <input
                    type="radio"
                    name={question.id}
                    required
                    checked={answers[qIndex] === oIndex}
                    onChange={() => setAnswers((prev) => questions.map((_, index) => (index === qIndex ? oIndex : prev[index] ?? null)))}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          ))}
          {!isSignedIn ? <p className="muted">You can take the assessment without an account. Sign in to save your result.</p> : null}
          <button className="primary" type="submit">See My Result</button>
        </form>
      ) : null}
    </section>
  );
}
