import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RecallQuestionReference } from "@/components/recall-question-reference";

afterEach(cleanup);

describe("RecallQuestionReference", () => {
  it("shows the AI grade and feedback with the latest recalled answer", () => {
    const id = "8acefc73-997a-4db5-a24a-afadf8799623";
    render(
      <RecallQuestionReference
        questions={[{ id, question: "What does aria-invalid communicate?", idealAnswer: "It communicates invalid state." }]}
        latestAnswers={[{
          id,
          question: "What does aria-invalid communicate?",
          idealAnswer: "It communicates invalid state.",
          answer: "It tells assistive technology that the value is invalid.",
        }]}
        latestGrades={[{
          questionId: id,
          score: 4,
          feedback: "Correctly explains that the attribute communicates invalid state.",
        }]}
      />,
    );

    expect(screen.getByText("AI grade: 4/4")).toBeInTheDocument();
    expect(screen.getByText("Correctly explains that the attribute communicates invalid state.")).toBeInTheDocument();
  });

  it("does not attach an old answer to edited question wording", () => {
    const id = "8acefc73-997a-4db5-a24a-afadf8799623";
    render(
      <RecallQuestionReference
        questions={[{ id, question: "What does aria-invalid communicate?", idealAnswer: "It communicates invalid state." }]}
        latestAnswers={[{
          id,
          question: "Does aria-invalid validate an input?",
          idealAnswer: "No. It only communicates state.",
          answer: "Yes, it validates the field.",
        }]}
      />,
    );

    expect(screen.queryByText("Show latest recalled answer")).not.toBeInTheDocument();
    expect(screen.queryByText("Yes, it validates the field.")).not.toBeInTheDocument();
  });
});
