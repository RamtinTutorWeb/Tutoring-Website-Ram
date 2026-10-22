import type { AssessmentQuestion } from "../api/types";

/** Scores answers and recommends the topic of the first missed question. */
export function scoreAssessment(
  questions: AssessmentQuestion[],
  answers: Array<number | null>
): { score: number; total: number; recommendation: string } {
  const missed = questions.filter((question, index) => answers[index] !== question.correctIndex);
  const score = questions.length - missed.length;
  const recommendation = missed.length === 0
    ? "Ready for advanced exam practice"
    : score === 0
      ? "Book a consultation to determine starting point"
      : missed[0].topic || "Book a consultation to plan next steps";
  return { score, total: questions.length, recommendation };
}
