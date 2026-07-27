import { createEmptyCard, date_scheduler, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import { LAPSE_GRADE_THRESHOLD } from "@/lib/ai/recall-judge-schema";
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
    latestRecallAnswers: [],
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

function assertContinuousGrade(grade: number): void {
  if (Number.isFinite(grade) === false || grade < Rating.Again || grade > Rating.Easy) {
    throw new RangeError("Continuous recall grade must be between 1 and 4.");
  }
}

function scheduleFsrsCard(
  card: Card,
  reviewedAt: Date,
  rating: ReviewRating,
  continuousGrade?: number | null,
): Card {
  if (continuousGrade === null || continuousGrade === undefined) {
    return fsrsScheduler.next(card, reviewedAt, ratingToFsrs(rating)).card;
  }
  assertContinuousGrade(continuousGrade);
  if (Number.isInteger(continuousGrade)) {
    return fsrsScheduler.next(card, reviewedAt, continuousGrade as Grade).card;
  }

  // ts-fsrs cannot consume fractional grades. Interpolate between its native
  // adjacent outcomes so all four integer anchors remain exactly compatible.
  const lowerGrade = Math.floor(continuousGrade) as Grade;
  const upperGrade = Math.ceil(continuousGrade) as Grade;
  const fraction = continuousGrade - lowerGrade;
  const anchors = fsrsScheduler.repeat(card, reviewedAt);
  const lower = anchors[lowerGrade].card;
  const upper = anchors[upperGrade].card;
  const stability = Math.exp(
    (1 - fraction) * Math.log(lower.stability) + fraction * Math.log(upper.stability),
  );
  const difficulty = card.state === State.New
    ? Math.min(10, Math.max(1, fsrsScheduler.init_difficulty(continuousGrade as Grade)))
    : fsrsScheduler.next_difficulty(card.difficulty, continuousGrade as Grade);
  const rawInterval = fsrsScheduler.next_interval(stability, lower.elapsed_days);
  const scheduledDays = Math.max(lower.scheduled_days, Math.min(upper.scheduled_days, rawInterval));

  if ([stability, difficulty, scheduledDays].every(Number.isFinite) === false) {
    throw new RangeError("Continuous FSRS interpolation produced a non-finite card.");
  }
  if (difficulty < 1 || difficulty > 10) {
    throw new RangeError("Continuous FSRS interpolation produced an invalid difficulty.");
  }

  return {
    ...lower,
    due: date_scheduler(reviewedAt, scheduledDays, true),
    stability,
    difficulty,
    scheduled_days: scheduledDays,
    reps: card.reps + 1,
    lapses: card.lapses + (card.state !== State.New && continuousGrade < LAPSE_GRADE_THRESHOLD ? 1 : 0),
    state: State.Review,
    learning_steps: 0,
    last_review: reviewedAt,
  };
}

export function scheduleReview(
  state: ReviewState,
  rating: ReviewRating,
  reviewedAt: Date,
  keepWarmDays: KeepWarmDays,
  timeZone = "Asia/Kolkata",
  continuousGrade?: number | null,
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
  const nextCard = scheduleFsrsCard(card, reviewedAt, rating, continuousGrade);
  let dueOn = dateKey(nextCard.due, timeZone);
  if (dayDifference(today, dueOn) < 1) dueOn = addCalendarDays(today, 1);
  nextCard.due = new Date(zonedNoonTimestamp(dueOn, timeZone));
  return {
    ...state,
    dueAt: nextCard.due.toISOString(),
    dueOn,
    lastReviewedAt: reviewedAt.toISOString(),
    reviewCount: state.reviewCount + 1,
    fsrsCard: serializeCard(nextCard),
  };
}

export function replayScheduler(
  target: SchedulerKind,
  learnedAt: Date | string,
  events: Array<Pick<ReviewEvent, "reviewedAt" | "rating"> & Partial<Pick<ReviewEvent, "id" | "continuousGrade">>>,
  keepWarmDays: KeepWarmDays,
  timeZone = "Asia/Kolkata",
): ReviewState {
  return [...events]
    .sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || (a.id ?? "").localeCompare(b.id ?? ""))
    .reduce(
      (state, event) => scheduleReview(
        state,
        event.rating,
        new Date(event.reviewedAt),
        keepWarmDays,
        timeZone,
        event.continuousGrade,
      ),
      typeof learnedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(learnedAt)
        ? createReviewStateFromDay(target, learnedAt, timeZone)
        : createReviewState(target, new Date(learnedAt), timeZone),
    );
}
