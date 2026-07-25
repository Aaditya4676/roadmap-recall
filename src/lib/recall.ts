import type { RecallAnswerSnapshot, RecallQuestion } from "@/lib/domain/types";

export const MAX_RECALL_QUESTIONS = 50;
export const MAX_RECALL_QUESTION_CHARS = 2_000;
export const MAX_RECALL_ANSWER_CHARS = 12_000;
export const MAX_RECALL_TOTAL_CHARS = 100_000;

function validText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

export function readRecallQuestions(value: unknown): RecallQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is RecallQuestion => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<RecallQuestion>;
      return typeof candidate.id === "string"
        && validText(candidate.question, MAX_RECALL_QUESTION_CHARS)
        && validText(candidate.idealAnswer, MAX_RECALL_ANSWER_CHARS);
    })
    .slice(0, MAX_RECALL_QUESTIONS);
}

export function readRecallAnswerSnapshots(value: unknown): RecallAnswerSnapshot[] {
  return readRecallQuestions(value).filter((item): item is RecallAnswerSnapshot => {
    const answer = (item as Partial<RecallAnswerSnapshot>).answer;
    return validText(answer, MAX_RECALL_ANSWER_CHARS);
  });
}

export function readyRecallQuestions(questions: RecallQuestion[] | null | undefined): RecallQuestion[] {
  return (questions ?? []).filter((item) => item.question.trim() && item.idealAnswer.trim());
}

export function buildRecallAnswerSnapshots(
  questions: RecallQuestion[],
  answers: Array<{ questionId: string; answer: string }>,
): RecallAnswerSnapshot[] {
  const ready = readyRecallQuestions(questions);
  const answerMap = new Map<string, string>();
  for (const item of answers) {
    if (answerMap.has(item.questionId)) throw new Error("Each recall question can only be answered once.");
    answerMap.set(item.questionId, item.answer);
  }
  if (answerMap.size !== ready.length || ready.some((item) => !answerMap.has(item.id))) {
    throw new Error("Recall questions changed. Reload this review before submitting.");
  }
  return ready.map((item) => ({ ...item, answer: answerMap.get(item.id) ?? "" }));
}

type ParsedPair = Pick<RecallQuestion, "question" | "idealAnswer">;

export function recallQuestionCharacterCount(
  questions: Array<Pick<RecallQuestion, "question" | "idealAnswer">>,
): number {
  return questions.reduce((total, item) => total + item.question.length + item.idealAnswer.length, 0);
}

/**
 * Parses a deliberately narrow, paste-friendly format:
 * Q: question
 * A: answer (which may continue across multiple lines)
 *
 * Invalid or oversized input throws instead of being truncated so the paste
 * remains in the editor and the user can split it without losing text.
 */
export function parseQuestionAnswerPairs(input: string): ParsedPair[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const pairs: ParsedPair[] = [];
  let question = "";
  let answerLines: string[] = [];
  let readingAnswer = false;

  function flush() {
    const normalizedQuestion = question.trim();
    const idealAnswer = answerLines.join("\n").trim();
    if (normalizedQuestion && idealAnswer) {
      if (normalizedQuestion.length > MAX_RECALL_QUESTION_CHARS) {
        throw new Error(`Each question must be ${MAX_RECALL_QUESTION_CHARS.toLocaleString()} characters or fewer.`);
      }
      if (idealAnswer.length > MAX_RECALL_ANSWER_CHARS) {
        throw new Error(`Each ideal answer must be ${MAX_RECALL_ANSWER_CHARS.toLocaleString()} characters or fewer.`);
      }
      if (pairs.length >= MAX_RECALL_QUESTIONS) {
        throw new Error(`A note can contain at most ${MAX_RECALL_QUESTIONS} recall questions.`);
      }
      const pair = { question: normalizedQuestion, idealAnswer };
      if (recallQuestionCharacterCount([...pairs, pair]) > MAX_RECALL_TOTAL_CHARS) {
        throw new Error("The pasted questions and answers are too large for one note.");
      }
      pairs.push(pair);
    }
    question = "";
    answerLines = [];
    readingAnswer = false;
  }

  for (const line of lines) {
    const questionMatch = line.match(/^\s*(?:q|question)(?:\s+\d+)?\s*[:.)-]\s*(.+)\s*$/i);
    const answerMatch = line.match(/^\s*(?:a|answer|ideal answer)(?:\s+\d+)?\s*[:.)-]\s*(.*)$/i);
    if (questionMatch) {
      flush();
      question = questionMatch[1];
      continue;
    }
    if (answerMatch && question) {
      readingAnswer = true;
      answerLines.push(answerMatch[1]);
      continue;
    }
    if (question && readingAnswer) answerLines.push(line);
    else if (question && line.trim()) question += ` ${line.trim()}`;
  }
  flush();
  return pairs;
}

export function recallQuestionsMarkdown(questions: RecallQuestion[]): string {
  const ready = readyRecallQuestions(questions);
  if (!ready.length) return "";
  return `## Recall questions\n\n${ready.map((item, index) => `### ${index + 1}. ${item.question}\n\n${item.idealAnswer}`).join("\n\n")}`;
}
