import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useContent } from "../api/ContentProvider";
import { useCreateAssessment } from "../api/hooks";
import { useMe } from "../api/MeProvider";
import { useSession } from "../auth/session";
import { scoreTest, testQuestions } from "../data/testQuestions";

interface Result {
  subject: string;
  answers: Array<number | null>;
  score: number;
  total: number;
  recommendation: string;
}

type SaveState = { status: "idle" | "saving" | "saved" | "error"; message: string };

export default function AssessmentPage() {
  const { content } = useContent();
  const { isSignedIn } = useSession();
  const { isAdmin } = useMe();
  const createAssessment = useCreateAssessment();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Array<number | null>>(() => testQuestions.map(() => null));
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
    const next: Result = { subject, answers, ...scoreTest(answers) };
    setResult(next);
    if (isSignedIn) void saveResult(next);
  }

  function restart() {
    setAnswers(testQuestions.map(() => null));
    setResult(null);
    setSave({ status: "idle", message: "" });
  }

  return (
    <section data-page="assessment" className="page">
      <h2>Assessment</h2>
      <p className="muted">A quick placement check. It takes about two minutes and helps us recommend where to start.</p>

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
      ) : (
        <form className="card" id="assessment-form" onSubmit={handleSubmit}>
          <label>Subject
            <select name="subject" required defaultValue="">
              <option value="">Select...</option>
              {subjects.map((subject) => <option key={subject}>{subject}</option>)}
            </select>
          </label>
          {testQuestions.map((question, qIndex) => (
            <fieldset className="list-item" key={question.id}>
              <legend><strong>{qIndex + 1}. {question.text}</strong></legend>
              {question.options.map((option, oIndex) => (
                <label className="check-row" key={option}>
                  <input
                    type="radio"
                    name={question.id}
                    required
                    checked={answers[qIndex] === oIndex}
                    onChange={() => setAnswers((prev) => prev.map((value, index) => (index === qIndex ? oIndex : value)))}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          ))}
          {!isSignedIn ? <p className="muted">You can take the assessment without an account. Sign in to save your result.</p> : null}
          <button className="primary" type="submit">See My Result</button>
        </form>
      )}
    </section>
  );
}
