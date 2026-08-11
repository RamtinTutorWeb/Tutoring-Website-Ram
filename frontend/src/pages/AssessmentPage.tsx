import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

export default function AssessmentPage() {
  const { currentUser, canUseAssessment } = useAppContext();
  const navigate = useNavigate();
  const gateMessage = currentUser
    ? "Assessment is available for student accounts."
    : "Login is required to access assessment tools.";

  return (
    <section data-page="assessment" className="page">
      <h2>Assessment</h2>

      {!canUseAssessment ? (
        <div className="card" id="assessment-gate">
          <p id="assessment-gate-message">{gateMessage}</p>
          <button className="primary" onClick={() => navigate(currentUser ? "/dashboard" : "/login")}>
            {currentUser ? "Go To Dashboard" : "Login Required"}
          </button>
        </div>
      ) : (
        <div className="card" id="assessment-coming-soon">
          <h3>Coming Soon</h3>
          <p className="muted">The questionnaire and assessment test are being prepared. This section will open when the content is ready.</p>
        </div>
      )}
    </section>
  );
}
