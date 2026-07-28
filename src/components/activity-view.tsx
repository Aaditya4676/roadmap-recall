"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { RecallAssessment } from "@/lib/ai/recall-judge-schema";
import { activityWeeks, type ActivityDay, type ActivitySummary } from "@/lib/activity";
import { addCalendarDays, humanDate } from "@/lib/date";
import type { ReviewRating } from "@/lib/domain/types";

export interface CompletedReviewItem {
  id: string;
  topicId: string;
  title: string;
  breadcrumb: string;
  reviewedOn: string;
  rating: ReviewRating;
  scheduler: "fsrs" | "fixed";
  answerCount: number;
  hasAiJudgment: boolean;
  hasContinuousGrade: boolean;
  usesContinuousScheduling: boolean;
  assessment: RecallAssessment | null;
}

function monthLabel(day: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T12:00:00.000Z`),
  );
}

function dayDescription(day: ActivityDay): string {
  const parts: string[] = [];
  if (day.topicsLearned) parts.push(`${day.topicsLearned} ${day.topicsLearned === 1 ? "topic" : "topics"} learned`);
  if (day.reviewsCompleted) parts.push(`${day.reviewsCompleted} ${day.reviewsCompleted === 1 ? "review" : "reviews"} completed`);
  if (day.dueReviewsCompleted) parts.push(`${day.dueReviewsCompleted} completed when due`);
  if (day.recoveredReviews) parts.push(`${day.recoveredReviews} ${day.recoveredReviews === 1 ? "review was" : "reviews were"} completed later`);
  if (!parts.length) parts.push(day.isFuture ? "Not reached yet" : "No activity recorded");
  return `${humanDate(day.day)}: ${parts.join("; ")}.`;
}

function todayMessage(today: ActivityDay): string {
  if (today.dueReviewsCompleted) return "Strong session — you returned to something when it mattered.";
  if (today.topicsLearned || today.reviewsCompleted) return "You showed up today. That is enough to keep the rhythm moving.";
  return "A short review or one captured idea is enough to light today.";
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex min-w-0 flex-col px-3 py-4 sm:px-5">
      <dt className="order-2 mt-1 text-xs text-[var(--muted)] sm:text-sm">{label}</dt>
      <dd className="order-1 text-2xl font-bold tracking-tight sm:text-3xl">{value}</dd>
    </div>
  );
}

function CalendarCell({ day, isToday, selected, tabStop, onSelect }: { day: ActivityDay; isToday: boolean; selected: boolean; tabStop: boolean; onSelect: (day: string) => void }) {
  const classes = [
    "activity-cell",
    `activity-level-${day.intensity}`,
    day.recoveryLevel ? "has-recovery" : "",
    day.dueReviewsCompleted ? "has-due-review" : "",
    day.isFuture ? "is-future" : "",
    isToday ? "is-today" : "",
    selected ? "is-selected" : "",
  ].filter(Boolean).join(" ");

  if (day.isFuture) return <time dateTime={day.day} className={classes} aria-hidden />;

  function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>) {
    const offsets: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const targetDay = addCalendarDays(day.day, offset);
    const target = event.currentTarget.closest(".activity-weeks")?.querySelector<HTMLButtonElement>(`[data-day="${targetDay}"]`);
    target?.focus();
    target?.click();
  }

  return (
    <button
      type="button"
      className={classes}
      data-day={day.day}
      data-recovery-level={day.recoveryLevel || undefined}
      aria-label={dayDescription(day)}
      aria-pressed={selected}
      title={dayDescription(day)}
      tabIndex={tabStop ? 0 : -1}
      onClick={() => onSelect(day.day)}
      onKeyDown={moveFocus}
    />
  );
}

function CalendarGrid({
  weeks,
  variant,
  today,
  selectedDay,
  onSelect,
  learningDays30,
}: {
  weeks: ActivityDay[][];
  variant: "compact" | "wide";
  today: string;
  selectedDay: string;
  onSelect: (day: string) => void;
  learningDays30: number;
}) {
  const containsSelected = weeks.some((week) => week.some((day) => day.day === selectedDay));
  const tabStopDay = containsSelected ? selectedDay : today;
  return (
    <div
      className={`activity-calendar activity-calendar-${variant}`}
      role="group"
      aria-label={`Learning activity calendar. ${learningDays30} active days in the last 30 days. Use arrow keys to move between dates.`}
    >
      <div aria-hidden className="activity-month-spacer" />
      <div aria-hidden className="activity-months">
        {weeks.map((week, index) => {
          const firstOfMonth = week.find((day) => day.day.endsWith("-01"));
          return (
            <span key={week[0].day}>
              {firstOfMonth ? monthLabel(firstOfMonth.day) : index === 0 ? monthLabel(week[0].day) : ""}
            </span>
          );
        })}
      </div>

      <div aria-hidden className="activity-weekdays">
        <span />
        <span>Mon</span>
        <span />
        <span>Wed</span>
        <span />
        <span>Fri</span>
        <span />
      </div>
      <div className="activity-weeks">
        {weeks.map((week) => (
          <div key={week[0].day} className="activity-week">
            {week.map((day) => (
              <CalendarCell
                key={day.day}
                day={day}
                isToday={day.day === today}
                selected={day.day === selectedDay}
                tabStop={day.day === tabStopDay}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityView({ summary, today, completedReviews = [], configuredProviders = [] }: { summary: ActivitySummary; today: string; completedReviews?: CompletedReviewItem[]; configuredProviders?: Array<"gemini" | "zai"> }) {
  const weeks = activityWeeks(summary.days);
  const [selectedDay, setSelectedDay] = useState(today);
  const selected = summary.days.find((day) => day.day === selectedDay) ?? summary.today;

  return (
    <>
      <header className="page-heading mb-8 max-w-none">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Activity</h1>
        <p className="mt-2 text-[var(--muted)]">A record of returning to what you learn, without a streak that resets.</p>
      </header>

      <section className="liquid-panel overflow-hidden rounded-[12px]" data-liquid aria-labelledby="rhythm-heading">
        <div className="glass-divider flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
          <div>
            <h2 id="rhythm-heading" className="text-lg font-bold">Learning rhythm</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">This view shows 13 weeks when space is limited and one year on wide screens.</p>
          </div>
          <p className="text-sm font-semibold text-[var(--activity-strong)]">{summary.learningDays7} of the last 7 days</p>
        </div>

        <div className="overflow-hidden px-4 py-5 sm:px-6">
          <CalendarGrid weeks={weeks.slice(-13)} variant="compact" today={today} selectedDay={selected.day} onSelect={setSelectedDay} learningDays30={summary.learningDays30} />
          <CalendarGrid weeks={weeks} variant="wide" today={today} selectedDay={selected.day} onSelect={setSelectedDay} learningDays30={summary.learningDays30} />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
            <p className="text-sm font-semibold" aria-live="polite">
              {selected.day === today ? todayMessage(summary.today) : dayDescription(selected)}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]" aria-label="Activity calendar legend">
              <span className="inline-flex items-center gap-1.5"><i aria-hidden className="activity-key activity-level-1" /> Learning</span>
              <span className="inline-flex items-center gap-1.5"><i aria-hidden className="activity-key activity-level-4 has-due-review" /> Due review</span>
              <span className="inline-flex items-center gap-1.5"><i aria-hidden className="activity-key activity-level-0 has-recovery" /> Returned later</span>
            </div>
          </div>
        </div>
      </section>

      <dl className="metric-strip mt-6 grid grid-cols-3 divide-x divide-[var(--border)] border-y">
        <Metric value={`${summary.learningDays7} / 7`} label="recent rhythm" />
        <Metric value={summary.learningDays30} label="learning days · last 30" />
        <Metric value={summary.reviews30} label="reviews · last 30" />
      </dl>

      <CompletedReviews initialReviews={completedReviews} configuredProviders={configuredProviders} />

      <details className="mt-6 border-b border-[var(--border)] py-1">
        <summary className="cursor-pointer py-3 font-semibold">How the calendar works</summary>
        <div className="max-w-3xl pb-5 text-sm leading-6 text-[var(--muted)]">
          <p>Learning any topic fills the day. A review that was due adds the coral edge. When you finish an overdue review within two weeks, its original due date receives a gold recovery mark.</p>
          <p className="mt-2">Recovery never pretends that the earlier day was active, and gaps never erase your history. Review ratings only schedule the next review; they do not change this calendar.</p>
        </div>
      </details>
    </>
  );
}

function CompletedReviews({ initialReviews, configuredProviders }: { initialReviews: CompletedReviewItem[]; configuredProviders: Array<"gemini" | "zai"> }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [provider, setProvider] = useState<"zai" | "gemini">(
    configuredProviders.includes("gemini") ? "gemini" : configuredProviders[0] ?? "gemini",
  );
  const [consent, setConsent] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  if (!reviews.length) return null;

  async function judge(review: CompletedReviewItem) {
    if (busyId || review.hasAiJudgment) return;
    setBusyId(review.id);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`/api/app/review-events/${review.id}/judge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ provider, consent: true }),
      });
      const data = await response.json() as {
        assessment?: RecallAssessment;
        appliedRating?: ReviewRating;
        error?: { message?: string };
      };
      if (!response.ok || !data.assessment || !data.appliedRating) {
        setError(data.error?.message ?? "The completed review could not be judged.");
        return;
      }
      setReviews((current) => current.map((item) => item.id === review.id ? {
        ...item,
        rating: data.appliedRating!,
        hasAiJudgment: true,
        hasContinuousGrade: true,
        usesContinuousScheduling: review.scheduler === "fsrs",
        assessment: data.assessment!,
      } : item));
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(requestError instanceof Error && requestError.message
          ? requestError.message
          : "The completed review could not be judged.");
      }
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusyId(null);
    }
  }

  async function applyContinuous(review: CompletedReviewItem) {
    if (busyId || !review.hasAiJudgment || review.usesContinuousScheduling) return;
    setBusyId(review.id);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`/api/app/review-events/${review.id}/apply-continuous`, {
        method: "POST",
        signal: controller.signal,
      });
      const data = await response.json() as { assessment?: RecallAssessment; error?: { message?: string } };
      if (!response.ok || !data.assessment) {
        setError(data.error?.message ?? "The continuous schedule could not be applied.");
        return;
      }
      setReviews((current) => current.map((item) => item.id === review.id ? {
        ...item,
        usesContinuousScheduling: true,
        hasContinuousGrade: true,
        assessment: data.assessment!,
      } : item));
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(requestError instanceof Error && requestError.message
          ? requestError.message
          : "The continuous schedule could not be applied.");
      }
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusyId(null);
    }
  }

  return (
    <section className="mt-8 border-y border-[var(--border)]" aria-labelledby="completed-reviews-heading">
      <div className="flex flex-wrap items-start justify-between gap-4 py-5">
        <div>
          <h2 id="completed-reviews-heading" className="text-lg font-bold">Completed reviews</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            An unjudged structured attempt can be assessed once. All its answers use one API request, then the full topic history is replayed so the rating affects its current schedule.
          </p>
        </div>
        {configuredProviders.length > 0 && <select
          aria-label="Completed review AI provider"
          className="field max-w-40"
          disabled={busyId !== null}
          value={provider}
          onChange={(event) => {
            setProvider(event.target.value as "zai" | "gemini");
            setConsent(false);
          }}
        >
          {configuredProviders.includes("gemini") && <option value="gemini">Gemini</option>}
          {configuredProviders.includes("zai") && <option value="zai">Z.AI</option>}
        </select>}
      </div>
      {configuredProviders.length > 0 && <label className="mb-5 flex items-start gap-2 text-sm text-[var(--muted)]">
        <input className="mt-1" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        Send a completed review&apos;s questions, ideal answers, and answers to {provider === "zai" ? "Z.AI" : "Gemini"} when I request a judgment.
      </label>}
      <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {reviews.map((review) => (
          <article key={review.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <Link className="font-semibold hover:underline" href={`/app/topics/${review.topicId}`}>{review.title}</Link>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {humanDate(review.reviewedOn)} / {review.answerCount} {review.answerCount === 1 ? "answer" : "answers"} / rating {review.rating}
              </p>
              {review.assessment && (
                <div className="mt-2 border-l-2 border-[var(--accent)] pl-3 text-sm">
                  <p className="font-semibold">
                    {review.assessment.retainedPercent}% answer quality / {review.scheduler === "fixed" ? "AI grade (fixed schedule)" : review.usesContinuousScheduling ? "FSRS grade" : review.hasContinuousGrade ? "stored AI grade" : "pending FSRS grade"} {review.assessment.continuousGrade.toFixed(2)}
                  </p>
                  <p className="mt-0.5 text-[var(--muted)]">{review.assessment.summary}</p>
                </div>
              )}
            </div>
            {!review.hasAiJudgment && configuredProviders.length > 0 && (
              <button type="button" className="button-secondary" disabled={busyId !== null || !consent} onClick={() => judge(review)}>
                <Sparkles size={17} /> {busyId === review.id ? "Judging and replaying..." : "Judge and update schedule"}
              </button>
            )}
            {review.scheduler === "fsrs" && review.hasAiJudgment && !review.hasContinuousGrade && review.assessment && (
              <button type="button" className="button-secondary" disabled={busyId !== null} onClick={() => applyContinuous(review)}>
                <Sparkles size={17} /> {busyId === review.id ? "Replaying..." : `Apply ${review.assessment.retainedPercent}% to schedule`}
              </button>
            )}
          </article>
        ))}
      </div>
      {error && <p role="alert" className="border-t border-[var(--border)] py-3 text-sm text-[var(--danger)]">{error}</p>}
    </section>
  );
}
