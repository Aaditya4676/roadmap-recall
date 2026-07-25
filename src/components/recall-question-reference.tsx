import { Markdown } from "@/components/markdown";
import type { RecallAnswerSnapshot, RecallQuestion } from "@/lib/domain/types";
import { readyRecallQuestions } from "@/lib/recall";

export function RecallQuestionReference({
  questions,
  latestAnswers = [],
}: {
  questions: RecallQuestion[];
  latestAnswers?: RecallAnswerSnapshot[];
}) {
  const ready = readyRecallQuestions(questions);
  if (!ready.length) return null;
  const latestById = new Map(latestAnswers.map((item) => [item.id, item]));

  return (
    <section className="mt-8" aria-labelledby="recall-reference-heading">
      <div className="mb-3">
        <h3 id="recall-reference-heading" className="text-lg font-bold">Recall questions</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Ideal answers stay hidden during review. Your newest attempt appears here after you submit one.</p>
      </div>
      <ol className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {ready.map((item, index) => {
          const candidate = latestById.get(item.id);
          const latest = candidate?.question === item.question && candidate.idealAnswer === item.idealAnswer
            ? candidate
            : undefined;
          return (
            <li className="py-5" key={item.id}>
              <p className="font-bold">{index + 1}. {item.question}</p>
              <div className="mt-3 border-l-2 border-[var(--accent)] pl-4">
                <p className="mb-1 text-xs font-bold text-[var(--muted)]">Ideal answer</p>
                <Markdown>{item.idealAnswer}</Markdown>
              </div>
              {latest && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--muted)]">Show latest recalled answer</summary>
                  <p className="mt-2 whitespace-pre-wrap border-l-2 border-[var(--border)] pl-4 text-sm">{latest.answer || "No answer was entered."}</p>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
