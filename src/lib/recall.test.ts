import { describe, expect, it } from "vitest";
import {
  buildRecallAnswerSnapshots,
  MAX_RECALL_ANSWER_CHARS,
  MAX_RECALL_QUESTION_CHARS,
  parseQuestionAnswerPairs,
  readRecallAnswerSnapshots,
  readyRecallQuestions,
  recallQuestionsMarkdown,
} from "@/lib/recall";

const questions = [
  {
    id: "8acefc73-997a-4db5-a24a-afadf8799623",
    question: "What does aria-invalid do?",
    idealAnswer: "It exposes invalid state but does not perform validation.",
  },
  {
    id: "1aeef304-29f8-410c-9fc5-622540d3dfd8",
    question: " ",
    idealAnswer: "",
  },
];

describe("structured recall", () => {
  it("parses Q/A paste blocks with multiline answers", () => {
    expect(parseQuestionAnswerPairs(`
Q: What is a live region?
A: It announces dynamic changes
without moving keyboard focus.

Question 2: What does disabled do?
Ideal answer: It prevents normal focus and activation.
`)).toEqual([
      { question: "What is a live region?", idealAnswer: "It announces dynamic changes\nwithout moving keyboard focus." },
      { question: "What does disabled do?", idealAnswer: "It prevents normal focus and activation." },
    ]);
  });

  it("snapshots trusted question text alongside each submitted answer", () => {
    expect(buildRecallAnswerSnapshots(questions, [{
      questionId: questions[0].id,
      answer: "It communicates the state to assistive technology.",
    }])).toEqual([{
      ...questions[0],
      answer: "It communicates the state to assistive technology.",
    }]);
    expect(() => buildRecallAnswerSnapshots(questions, [])).toThrow("Recall questions changed");
    expect(() => buildRecallAnswerSnapshots(questions, [
      { questionId: questions[0].id, answer: "First" },
      { questionId: questions[0].id, answer: "Duplicate" },
    ])).toThrow("only be answered once");
  });

  it("rejects oversized pasted pairs without truncating them", () => {
    expect(() => parseQuestionAnswerPairs(`Q: ${"q".repeat(MAX_RECALL_QUESTION_CHARS + 1)}\nA: answer`))
      .toThrow("question must be");
    expect(() => parseQuestionAnswerPairs(`Q: question\nA: ${"a".repeat(MAX_RECALL_ANSWER_CHARS + 1)}`))
      .toThrow("ideal answer must be");
  });

  it("keeps incomplete authoring rows out of review and formats ready references", () => {
    expect(readyRecallQuestions(questions)).toEqual([questions[0]]);
    expect(recallQuestionsMarkdown(questions)).toContain("## Recall questions");
    expect(recallQuestionsMarkdown(questions)).not.toContain("### 2.");
  });

  it("rejects malformed latest-state entries instead of trusting partial JSON", () => {
    expect(readRecallAnswerSnapshots([
      { ...questions[0], answer: "Valid" },
      { ...questions[0] },
    ])).toEqual([{ ...questions[0], answer: "Valid" }]);
  });
});
