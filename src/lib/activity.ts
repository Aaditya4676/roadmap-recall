import { addCalendarDays, dayDifference } from "@/lib/date";

export type ActivityEvent =
  | {
      kind: "learned";
      topicId: string;
      eventOn: string;
      previousDueOn: null;
    }
  | {
      kind: "reviewed";
      topicId: string;
      eventOn: string;
      previousDueOn: string;
    };

export type ActivityIntensity = 0 | 1 | 2 | 3 | 4;
export type RecoveryLevel = 0 | 1 | 2 | 3;

export interface ActivityDay {
  day: string;
  score: number;
  intensity: ActivityIntensity;
  topicsLearned: number;
  reviewsCompleted: number;
  dueReviewsCompleted: number;
  recoveredReviews: number;
  recoveryLevel: RecoveryLevel;
  isFuture: boolean;
}

export interface ActivitySummary {
  days: ActivityDay[];
  learningDays7: number;
  learningDays30: number;
  reviews30: number;
  topicsLearned30: number;
  today: ActivityDay;
}

const MAX_DAILY_SCORE = 10;

function intensityFor(score: number): ActivityIntensity {
  if (score <= 0) return 0;
  if (score <= 2) return 1;
  if (score <= 5) return 2;
  if (score <= 8) return 3;
  return 4;
}

function recoveryFor(daysLate: number): RecoveryLevel {
  if (daysLate <= 0 || daysLate > 14) return 0;
  if (daysLate <= 2) return 3;
  if (daysLate <= 7) return 2;
  return 1;
}

function emptyDay(day: string, today: string): ActivityDay {
  return {
    day,
    score: 0,
    intensity: 0,
    topicsLearned: 0,
    reviewsCompleted: 0,
    dueReviewsCompleted: 0,
    recoveredReviews: 0,
    recoveryLevel: 0,
    isFuture: day > today,
  };
}

/**
 * Builds a truthful activity calendar from immutable domain events.
 *
 * Scores only control visual intensity. They are deliberately independent of
 * review ratings, note length, AI output, and page views so the UI cannot
 * encourage users to corrupt scheduler feedback or manufacture activity.
 */
export function buildActivitySummary(
  events: ActivityEvent[],
  rangeStart: string,
  rangeEnd: string,
  today: string,
): ActivitySummary {
  const days = new Map<string, ActivityDay>();
  for (let day = rangeStart; day <= rangeEnd; day = addCalendarDays(day, 1)) {
    days.set(day, emptyDay(day, today));
  }

  const countedLearning = new Set<string>();
  const countedReviews = new Set<string>();

  for (const event of events) {
    if (event.eventOn > today) continue;

    const eventDay = days.get(event.eventOn);
    if (event.kind === "learned") {
      const dedupeKey = `${event.topicId}:${event.eventOn}`;
      if (eventDay && !countedLearning.has(dedupeKey)) {
        countedLearning.add(dedupeKey);
        eventDay.topicsLearned += 1;
        eventDay.score = Math.min(MAX_DAILY_SCORE, eventDay.score + 2);
      }
      continue;
    }

    const reviewKey = `${event.topicId}:${event.eventOn}`;
    if (eventDay && !countedReviews.has(reviewKey)) {
      countedReviews.add(reviewKey);
      const wasDue = event.eventOn >= event.previousDueOn;
      eventDay.reviewsCompleted += 1;
      eventDay.dueReviewsCompleted += wasDue ? 1 : 0;
      eventDay.score = Math.min(MAX_DAILY_SCORE, eventDay.score + (wasDue ? 3 : 1));
    }

    const daysLate = dayDifference(event.previousDueOn, event.eventOn);
    const recoveryLevel = recoveryFor(daysLate);
    const dueDay = days.get(event.previousDueOn);
    if (dueDay && recoveryLevel > 0) {
      dueDay.recoveredReviews += 1;
      dueDay.recoveryLevel = Math.max(dueDay.recoveryLevel, recoveryLevel) as RecoveryLevel;
    }
  }

  for (const day of days.values()) day.intensity = intensityFor(day.score);

  const ordered = [...days.values()];
  const recent = (count: number) => {
    const from = addCalendarDays(today, -(count - 1));
    return ordered.filter((day) => day.day >= from && day.day <= today);
  };
  const last7 = recent(7);
  const last30 = recent(30);

  return {
    days: ordered,
    learningDays7: last7.filter((day) => day.score > 0).length,
    learningDays30: last30.filter((day) => day.score > 0).length,
    reviews30: last30.reduce((total, day) => total + day.reviewsCompleted, 0),
    topicsLearned30: last30.reduce((total, day) => total + day.topicsLearned, 0),
    today: days.get(today) ?? emptyDay(today, today),
  };
}

export function activityCalendarRange(today: string, weeks = 53): { start: string; end: string } {
  if (!Number.isInteger(weeks) || weeks < 1) throw new Error("weeks must be a positive integer");
  const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay();
  const currentWeekStart = addCalendarDays(today, -weekday);
  return {
    start: addCalendarDays(currentWeekStart, -(weeks - 1) * 7),
    end: addCalendarDays(currentWeekStart, 6),
  };
}

export function activityWeeks(days: ActivityDay[]): ActivityDay[][] {
  const weeks: ActivityDay[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return weeks;
}
