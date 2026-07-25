import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecallQuestionReference } from "@/components/recall-question-reference";

describe("RecallQuestionReference", () => {
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
