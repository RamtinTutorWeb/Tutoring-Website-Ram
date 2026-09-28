export interface TestQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  recommendationTag: string;
}

export const testQuestions: TestQuestion[] = [
  {
    id: "q1",
    text: "If 2x + 5 = 17, what is x?",
    options: ["4", "5", "6", "8"],
    correctIndex: 2,
    recommendationTag: "Algebra Foundations"
  },
  {
    id: "q2",
    text: "What is sin(30°)?",
    options: ["1", "1/2", "√2/2", "√3/2"],
    correctIndex: 1,
    recommendationTag: "Trigonometry Basics"
  },
  {
    id: "q3",
    text: "Sequence: 3, 6, 12, 24, ... next value?",
    options: ["30", "36", "42", "48"],
    correctIndex: 3,
    recommendationTag: "Patterns and Sequences"
  },
  {
    id: "q4",
    text: "A car accelerates uniformly from rest to 20 m/s in 4 s. What is its acceleration?",
    options: ["4 m/s²", "5 m/s²", "16 m/s²", "80 m/s²"],
    correctIndex: 1,
    recommendationTag: "Kinematics"
  },
  {
    id: "q5",
    text: "What is the derivative of x³?",
    options: ["x²", "3x", "3x²", "x⁴/4"],
    correctIndex: 2,
    recommendationTag: "Calculus Foundations"
  }
];

/** Scores answers and recommends the topic of the first missed question. */
export function scoreTest(answers: Array<number | null>): { score: number; total: number; recommendation: string } {
  const missed = testQuestions.filter((question, index) => answers[index] !== question.correctIndex);
  const score = testQuestions.length - missed.length;
  const recommendation = missed.length === 0
    ? "Ready for advanced exam practice"
    : score === 0
      ? "Book a consultation to determine starting point"
      : missed[0].recommendationTag;
  return { score, total: testQuestions.length, recommendation };
}
