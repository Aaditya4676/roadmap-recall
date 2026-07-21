import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import {
  addCalendarDays,
  dateKey,
  dayDifference,
  zonedNoonTimestamp,
} from "@/lib/date";
import type {
  FixedRating,
  KeepWarmDays,
  ReviewEvent,
  ReviewRating,
  ReviewState,
  SchedulerKind,
  SerializedCard,
} from "@/lib/domain/types";

const fsrsScheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: false,
  enable_short_term: false,
  learning_steps: [],
  relearning_steps: [],
});

function serializeCard(card: Card): SerializedCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
  };
}

function hydrateCard(card: SerializedCard): Card {
  return {
    ...card,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

export function createReviewState(
  scheduler: SchedulerKind,
  learnedAt: Date,
  timeZone = "Asia/Kolkata",
): ReviewState {
  const learnedOn = dateKey(learnedAt, timeZone);
  return createReviewStateFromDay(scheduler, learnedOn, timeZone);
}

export function createReviewStateFromDay(
  scheduler: SchedulerKind,
  learnedOn: string,
  timeZone = "Asia/Kolkata",
): ReviewState {
  const dueOn = addCalendarDays(learnedOn, 1);
  const card = createEmptyCard(new Date(zonedNoonTimestamp(learnedOn, timeZone)));
  card.due = new Date(zonedNoonTimestamp(dueOn, timeZone));
  return {
    scheduler,
    dueAt: zonedNoonTimestamp(dueOn, timeZone),
    dueOn,
    lastReviewedAt: null,
    reviewCount: 0,
    fixedStage: 0,
    fsrsCard: scheduler === "fsrs" ? serializeCard(card) : null,
  };
}

function fixedGoodInterval(stage: number, keepWarmDays: KeepWarmDays): number {
  if (stage <= 0) return 7;
  if (stage === 1) return 30;
  return keepWarmDays ?? 30;
}

export function fixedIntervalDays(
  state: Pick<ReviewState, "fixedStage">,
  rating: FixedRating,
  keepWarmDays: KeepWarmDays,
): { days: number; nextStage: number } {
  if (rating === "again") return { days: 1, nextStage: state.fixedStage };
  const goodDays = fixedGoodInterval(state.fixedStage, keepWarmDays);
  if (rating === "hard") {
    return { days: Math.max(1, Math.ceil(goodDays / 2)), nextStage: state.fixedStage };
  }
  return { days: goodDays, nextStage: state.fixedStage + 1 };
}

function ratingToFsrs(rating: ReviewRating): Grade {
  return {
    again: Rating.Again,
    hard: Rating.Hard,
    good: Rating.Good,
    easy: Rating.Easy,
  }[rating] as Grade;
}

export function scheduleReview(
  state: ReviewState,
  rating: ReviewRating,
  reviewedAt: Date,
  keepWarmDays: KeepWarmDays,
  timeZone = "Asia/Kolkata",
): ReviewState {
  const today = dateKey(reviewedAt, timeZone);

  if (state.scheduler === "fixed") {
    const fixedRating: FixedRating = rating === "easy" ? "good" : rating;
    const result = fixedIntervalDays(state, fixedRating, keepWarmDays);
    const dueOn = addCalendarDays(today, result.days);
    return {
      ...state,
      dueAt: zonedNoonTimestamp(dueOn, timeZone),
      dueOn,
      lastReviewedAt: reviewedAt.toISOString(),
      reviewCount: state.reviewCount + 1,
      fixedStage: result.nextStage,
    };
  }

  const card = state.fsrsCard
    ? hydrateCard(state.fsrsCard)
    : createEmptyCard(reviewedAt);
  const result = fsrsScheduler.next(card, reviewedAt, ratingToFsrs(rating));
  let dueOn = dateKey(result.card.due, timeZone);
  if (dayDifference(today, dueOn) < 1) dueOn = addCalendarDays(today, 1);
  result.card.due = new Date(zonedNoonTimestamp(dueOn, timeZone));
  return {
    ...state,
    dueAt: result.card.due.toISOString(),
    dueOn,
    lastReviewedAt: reviewedAt.toISOString(),
    reviewCount: state.reviewCount + 1,
    fsrsCard: serializeCard(result.card),
  };
}

export function replayScheduler(
  target: SchedulerKind,
  learnedAt: Date | string,
  events: Pick<ReviewEvent, "reviewedAt" | "rating">[],
  keepWarmDays: KeepWarmDays,
  timeZone = "Asia/Kolkata",
): ReviewState {
  return [...events]
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))
    .reduce(
      (state, event) => scheduleReview(state, event.rating, new Date(event.reviewedAt), keepWarmDays, timeZone),
      typeof learnedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(learnedAt)
        ? createReviewStateFromDay(target, learnedAt, timeZone)
        : createReviewState(target, new Date(learnedAt), timeZone),
    );
}
