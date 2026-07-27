"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FocusTextarea } from "@/components/focus-textarea";
import { Markdown } from "@/components/markdown";
import type { RecallAssessment } from "@/lib/ai/recall-judge-schema";
import type { RecallQuestion, ReviewRating, ReviewState, StudyTopic } from "@/lib/domain/types";
import {
  MAX_RECALL_ANSWER_CHARS,
  MAX_RECALL_TOTAL_CHARS,
  readRecallAnswerSnapshots,
  readyRecallQuestions,
} from "@/lib/recall";

const MAX_SCRATCHPAD_CHARS = 20_000;

type ReviewResponse = {
  reviewState?: ReviewState;
  error?: {
    message?: string;
    issues?: Array<{ message?: string }>;
  };
};

type JudgeResponse = {
  assessment?: RecallAssessment;
  error?: ReviewResponse["error"];
};

function responseErrorMessage(data: ReviewResponse, fallback: string): string {
  return data.error?.message
    ?? data.error?.issues?.find((issue) => issue.message)?.message
    ?? fallback;
}

function QuestionRecall({
  questions,
  answers,
  previous,
  revealed,
  onAnswer,
}: {
  questions: RecallQuestion[];
  answers: Record<string, string>;
  previous: StudyTopic["reviewState"]["latestRecallAnswers"];
  revealed: boolean;
  onAnswer: (id: string, answer: string) => void;
}) {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const answeredCount = questions.filter((item) => (answers[item.id] ?? "").trim()).length;
  return (
    <section className="mt-7" aria-labelledby="question-recall-heading">
      <div className="mb-4">
        <h2 id="question-recall-heading" className="text-lg font-bold">Answer from memory</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Commit to an answer before checking the reference. A blank answer is still useful evidence about what needs work.
        </p>
        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{answeredCount} of {questions.length} answered</p>
      </div>
      <ol className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {questions.map((item, index) => {
          const candidate = previousById.get(item.id);
          const prior = candidate?.question === item.question && candidate.idealAnswer === item.idealAnswer
            ? candidate
            : undefined;
          return (
            <li className="py-5" key={item.id}>
              <FocusTextarea
                label={<span>{index + 1}. {item.question}</span>}
                dialogTitle={`Question ${index + 1}: ${item.question}`}
                autoFocus={index === 0}
                className="min-h-32 sm:min-h-36"
                maxLength={MAX_RECALL_ANSWER_CHARS}
                readOnly={revealed}
                value={answers[item.id] ?? ""}
                onChange={(answer) => onAnswer(item.id, answer)}
                placeholder="Explain it without opening your notes…"
              />
              {revealed && (
                <div className="mt-4 grid gap-4 border-l-2 border-[var(--accent)] pl-4">
                  <div>
                    <p className="mb-1 text-xs font-bold text-[var(--muted)]">Ideal answer</p>
                    <Markdown>{item.idealAnswer}</Markdown>
                  </div>
                  {prior && (
                    <div>
                      <p className="mb-1 text-xs font-bold text-[var(--muted)]">Previous attempt</p>
                      <p className="whitespace-pre-wrap text-sm">{prior.answer || "No answer was entered."}</p>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function ReviewSession({
  initialTopics,
  mode = "queue",
}: {
  initialTopics: StudyTopic[];
  mode?: "queue" | "single";
}) {
  const router = useRouter();
  const [topics, setTopics] = useState(initialTopics);
  const [index, setIndex] = useState(0);
  const [scratchpad, setScratchpad] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [append, setAppend] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [aiRevealed, setAiRevealed] = useState(false);
  const [judgeProvider, setJudgeProvider] = useState<"zai" | "gemini">("zai");
  const [judgeConsent, setJudgeConsent] = useState(false);
  const [judging, setJudging] = useState(false);
  const [assessment, setAssessment] = useState<RecallAssessment | null>(null);
  const [judgeError, setJudgeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [answerError, setAnswerError] = useState("");
  const [conflict, setConflict] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  const judgeRequest = useRef<AbortController | null>(null);
  const topic = topics[index];
  const recallQuestions = topic ? readyRecallQuestions(topic.note.recallQuestions) : [];
  const usesQuestions = recallQuestions.length > 0;
  const returnHref = mode === "single" && topics[0] ? `/app/topics/${topics[0].id}` : "/app/today";

  useEffect(() => () => {
    request.current?.abort();
    judgeRequest.current?.abort();
  }, []);

  if (!topic) {
    return (
      <div className="liquid-panel mx-auto max-w-xl rounded-[12px] p-10 text-center" data-liquid>
        <CheckCircle2 size={44} className="mx-auto text-[var(--accent)]" />
        <h1 className="mt-4 text-3xl font-bold">Review complete</h1>
        <p className="mt-2 text-[var(--muted)]">
          {mode === "single"
            ? "Your response was saved and the next review was scheduled."
            : `You recalled ${topics.length} ${topics.length === 1 ? "topic" : "topics"}. That is enough for today.`}
        </p>
        <Link className="button-primary mt-7" data-liquid href={returnHref} onClick={() => router.refresh()}>
          {mode === "single" ? "Return to topic" : "Return to Today"}
        </Link>
      </div>
    );
  }

  function updateAnswer(id: string, answer: string) {
    const total = Object.entries(answers).reduce(
      (sum, [questionId, value]) => sum + (questionId === id ? 0 : value.length),
      answer.length,
    );
    if (total > MAX_RECALL_TOTAL_CHARS) {
      setAnswerError("Your answers can use up to 100,000 characters in one review.");
      return;
    }
    setAnswerError("");
    setAssessment(null);
    setJudgeError("");
    setAnswers((current) => ({ ...current, [id]: answer }));
  }

  async function judgeAnswers() {
    if (judging || !topic || !usesQuestions) return;
    setJudging(true);
    setJudgeError("");
    setAssessment(null);
    const controller = new AbortController();
    judgeRequest.current = controller;
    try {
      const response = await fetch(`/api/app/topics/${topic.id}/review/judge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          provider: judgeProvider,
          consent: true,
          expectedNoteRevision: topic.note.revision,
          answers: recallQuestions.map((item) => ({ questionId: item.id, answer: answers[item.id] ?? "" })),
        }),
      });
      const data = await response.json() as JudgeResponse;
      if (!response.ok || !data.assessment) {
        setJudgeError(responseErrorMessage(data, "The AI judge could not assess these answers."));
        return;
      }
      setAssessment(data.assessment);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setJudgeError(requestError instanceof Error && requestError.message
          ? requestError.message
          : "The AI judge could not assess these answers. You can still rate manually.");
      }
    } finally {
      if (judgeRequest.current === controller) judgeRequest.current = null;
      if (!controller.signal.aborted) setJudging(false);
    }
  }

  async function rate(rating: ReviewRating, aiAssessment: RecallAssessment | null = null) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    setConflict(false);
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`/api/app/topics/${topic.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          rating,
          expectedReviewCount: topic.reviewState.reviewCount,
          scratchpad: usesQuestions ? "" : scratchpad,
          appendScratchpad: usesQuestions ? false : append,
          recallAnswers: recallQuestions.map((item) => ({ questionId: item.id, answer: answers[item.id] ?? "" })),
          aiAssessment,
        }),
      });
      const data = await response.json() as ReviewResponse;
      if (!response.ok) {
        setError(responseErrorMessage(data, "Could not save the review."));
        setConflict(response.status === 409);
        return;
      }
      if (!data.reviewState) throw new Error("The review response was incomplete.");
      const reviewState = {
        ...data.reviewState,
        latestRecallAnswers: readRecallAnswerSnapshots(data.reviewState.latestRecallAnswers),
      };
      setTopics((current) => current.map((item) => item.id === topic.id ? { ...item, reviewState } : item));
      setIndex((value) => value + 1);
      setScratchpad("");
      setAnswers({});
      setAppend(false);
      setRevealed(false);
      setAiRevealed(false);
      setAssessment(null);
      setJudgeError("");
      setJudgeConsent(false);
      setAnswerError("");
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(requestError instanceof Error && requestError.message
          ? requestError.message
          : "The review could not be saved. Check your connection and try again.");
      }
    } finally {
      if (request.current === controller) request.current = null;
      inFlight.current = false;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <Link href={returnHref} className="button-ghost">
          {mode === "single" ? "← Back to topic" : "← End session"}
        </Link>
        <span className="text-sm text-[var(--muted)]">{index + 1} / {topics.length}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-[var(--subtle)]" role="progressbar" aria-label="Review progress" aria-valuemin={0} aria-valuemax={topics.length} aria-valuenow={index}>
        <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${(index / topics.length) * 100}%` }} />
      </div>
      <article className="liquid-panel mt-5 rounded-[12px] p-5 sm:p-8" data-liquid>
        <p className="context-label">Recall before reveal</p>
        <h1 className="mt-2 text-balance text-3xl font-bold sm:text-4xl">{topic.title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{topic.breadcrumb}</p>

        {usesQuestions ? (
          <QuestionRecall
            questions={recallQuestions}
            answers={answers}
            previous={topic.reviewState.latestRecallAnswers}
            revealed={revealed}
            onAnswer={updateAnswer}
          />
        ) : (
          <>
            <div className="mt-7">
              <FocusTextarea
                label="What can you explain from memory?"
                dialogTitle={`${topic.title}: recall from memory`}
                autoFocus
                className="min-h-64 sm:min-h-72"
                maxLength={MAX_SCRATCHPAD_CHARS}
                value={scratchpad}
                onChange={setScratchpad}
                placeholder="Use this space to reconstruct the idea…"
              />
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm text-[var(--muted)]">
              <input className="mt-1" type="checkbox" checked={append} onChange={(event) => setAppend(event.target.checked)} />
              Append this scratchpad to my personal note after rating
            </label>
          </>
        )}
        {answerError && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{answerError}</p>}

        {!revealed ? (
          <button className="button-primary mt-6 w-full" data-liquid onClick={() => setRevealed(true)}>
            {usesQuestions ? "Check my answers" : "Reveal my notes"}
          </button>
        ) : (
          <>
            {usesQuestions ? (
              <details className="mt-5 border-y border-[var(--border)] py-4">
                <summary className="cursor-pointer font-semibold text-[var(--muted)]">Open full reference note</summary>
                <div className="reading-plane mt-4 p-5">
                  <Markdown>{topic.note.markdown || "_No reference note was captured._"}</Markdown>
                </div>
              </details>
            ) : (
              <section className="reading-plane mt-6 p-5">
                <p className="context-label mb-3">My notes</p>
                <Markdown>{topic.note.markdown || "_No note was captured._"}</Markdown>
              </section>
            )}
            {topic.aiNote && !topic.aiNote.hidden && (
              !aiRevealed ? (
                <button className="button-secondary mt-3 w-full" data-liquid onClick={() => setAiRevealed(true)}><Sparkles size={17} /> Reveal separate AI notes</button>
              ) : (
                <section className="ai-plane mt-3 p-5">
                  <p className="context-label mb-3">AI notes · {topic.aiNote.model}</p>
                  <p>{topic.aiNote.document.summary}</p>
                  <ul className="mt-3 list-disc pl-5">{topic.aiNote.document.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                </section>
              )
            )}
            {usesQuestions && recallQuestions.some((item) => !(answers[item.id] ?? "").trim()) && (
              <p className="mt-5 text-center text-sm text-[var(--warning)]">Some answers were blank. That is useful feedback—consider Again if you could not retrieve them.</p>
            )}
            {usesQuestions && (
              <section className="mt-6 border-y border-[var(--border)] py-5" aria-labelledby="ai-judge-heading">
                <h2 id="ai-judge-heading" className="font-bold">Optional AI judgment</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Compare every answer in one provider request for a suggested rating. You can ignore it and rate manually.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label="AI judge provider"
                    className="field sm:max-w-44"
                    disabled={judging}
                    value={judgeProvider}
                    onChange={(event) => {
                      setJudgeProvider(event.target.value as "zai" | "gemini");
                      setJudgeConsent(false);
                    }}
                  >
                    <option value="zai">Z.AI</option>
                    <option value="gemini">Gemini</option>
                  </select>
                  <button type="button" className="button-secondary" disabled={judging || saving || !judgeConsent} onClick={judgeAnswers}>
                    <Sparkles size={17} /> {judging ? "Judging..." : assessment ? "Judge again" : "Judge my answers"}
                  </button>
                </div>
                <label className="mt-3 flex items-start gap-2 text-sm text-[var(--muted)]">
                  <input className="mt-1" type="checkbox" checked={judgeConsent} onChange={(event) => setJudgeConsent(event.target.checked)} />
                  Send these questions, ideal answers, and my attempt to {judgeProvider === "zai" ? "Z.AI" : "Gemini"} for this judgment.
                </label>
                {judgeError && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{judgeError} Manual rating is still available below.</p>}
                {assessment && (
                  <div className="mt-4 border-l-2 border-[var(--accent)] pl-4" aria-live="polite">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-bold">{assessment.retainedPercent}% retained / {assessment.recommendedRating}</p>
                      <p className="text-xs text-[var(--muted)]">{assessment.provider} / {assessment.model}</p>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">{assessment.summary}</p>
                    <ol className="mt-3 grid gap-2 text-sm">
                      {assessment.results.map((result, resultIndex) => (
                        <li key={result.questionId}><strong>{resultIndex + 1}. {result.score}/4</strong> - {result.feedback}</li>
                      ))}
                    </ol>
                    <button
                      type="button"
                      className="button-primary mt-4"
                      disabled={saving}
                      onClick={() => rate(
                        topic.scheduler === "fixed" && assessment.recommendedRating === "easy" ? "good" : assessment.recommendedRating,
                        assessment,
                      )}
                    >
                      Use {topic.scheduler === "fixed" && assessment.recommendedRating === "easy" ? "good" : assessment.recommendedRating} rating
                    </button>
                  </div>
                )}
              </section>
            )}
            <p className="mb-2 mt-7 text-center text-sm font-bold">{assessment ? "Or choose the rating yourself" : "How well did you recall it?"}</p>
            <div className={`grid gap-2 ${topic.scheduler === "fsrs" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
              {(["again", "hard", "good", ...(topic.scheduler === "fsrs" ? ["easy"] : [])] as ReviewRating[]).map((rating) => (
                <button disabled={saving || judging} key={rating} data-liquid className={rating === "good" ? "button-primary capitalize" : "button-secondary capitalize"} onClick={() => rate(rating)}>{rating}</button>
              ))}
            </div>
            {error && <p role="alert" className="mt-4 text-center text-sm text-[var(--danger)]">{error}</p>}
            {conflict && (
              <button type="button" className="button-secondary mx-auto mt-3" onClick={() => window.location.reload()}>
                Reload this session
              </button>
            )}
          </>
        )}
      </article>
    </div>
  );
}
