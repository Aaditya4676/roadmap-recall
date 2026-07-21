import { describe, expect, it } from "vitest";
import { activityCalendarRange, activityWeeks, buildActivitySummary, type ActivityEvent } from "@/lib/activity";

const learned = (topicId: string, eventOn: string): ActivityEvent => ({
  kind: "learned",
  topicId,
  eventOn,
  previousDueOn: null,
});

const reviewed = (topicId: string, eventOn: string, previousDueOn: string): ActivityEvent => ({
  kind: "reviewed",
  topicId,
  eventOn,
  previousDueOn,
});

describe("learning activity", () => {
  it("scores learning, early reviews, and due reviews without rating-based inputs", () => {
    const summary = buildActivitySummary([
      learned("topic-a", "2026-07-21"),
      learned("topic-b", "2026-07-21"),
      reviewed("topic-c", "2026-07-21", "2026-07-23"),
      reviewed("topic-d", "2026-07-21", "2026-07-21"),
    ], "2026-07-20", "2026-07-22", "2026-07-21");

    expect(summary.today).toMatchObject({
      score: 8,
      intensity: 3,
      topicsLearned: 2,
      reviewsCompleted: 2,
      dueReviewsCompleted: 1,
    });
  });

  it("caps visual strength and counts at most one review per topic per day", () => {
    const events: ActivityEvent[] = [
      reviewed("same-topic", "2026-07-21", "2026-07-20"),
      reviewed("same-topic", "2026-07-21", "2026-07-21"),
      ...Array.from({ length: 5 }, (_, index) => learned(`topic-${index}`, "2026-07-21")),
    ];
    const summary = buildActivitySummary(events, "2026-07-21", "2026-07-21", "2026-07-21");
    expect(summary.today.score).toBe(10);
    expect(summary.today.intensity).toBe(4);
    expect(summary.today.reviewsCompleted).toBe(1);
  });

  it("adds a fading recovery bridge to the original due date without inventing raw activity", () => {
    const summary = buildActivitySummary([
      reviewed("quick", "2026-07-08", "2026-07-07"),
      reviewed("week", "2026-07-14", "2026-07-07"),
      reviewed("fortnight", "2026-07-21", "2026-07-07"),
      reviewed("too-late", "2026-07-22", "2026-07-07"),
    ], "2026-07-07", "2026-07-22", "2026-07-22");

    const dueDay = summary.days.find((day) => day.day === "2026-07-07");
    expect(dueDay).toMatchObject({ score: 0, intensity: 0, recoveredReviews: 3, recoveryLevel: 3 });
    expect(summary.learningDays30).toBe(4);
  });

  it("uses rolling rhythm windows and ignores future-dated events", () => {
    const summary = buildActivitySummary([
      learned("old", "2026-06-21"),
      learned("week-a", "2026-07-15"),
      reviewed("week-b", "2026-07-20", "2026-07-19"),
      learned("today", "2026-07-21"),
      learned("future", "2026-07-22"),
    ], "2026-06-20", "2026-07-23", "2026-07-21");

    expect(summary.learningDays7).toBe(3);
    expect(summary.learningDays30).toBe(3);
    expect(summary.reviews30).toBe(1);
    expect(summary.days.find((day) => day.day === "2026-07-22")?.score).toBe(0);
  });

  it("keeps the fourteen-day recovery boundary and ignores the fifteenth day", () => {
    const atBoundary = buildActivitySummary(
      [reviewed("boundary", "2026-07-15", "2026-07-01")],
      "2026-07-01",
      "2026-07-15",
      "2026-07-15",
    );
    const outsideBoundary = buildActivitySummary(
      [reviewed("outside", "2026-07-16", "2026-07-01")],
      "2026-07-01",
      "2026-07-16",
      "2026-07-16",
    );
    expect(atBoundary.days[0]).toMatchObject({ recoveryLevel: 1, recoveredReviews: 1, score: 0 });
    expect(outsideBoundary.days[0]).toMatchObject({ recoveryLevel: 0, recoveredReviews: 0, score: 0 });
  });

  it("returns a complete zero summary when no events exist", () => {
    const summary = buildActivitySummary([], "2026-07-19", "2026-07-25", "2026-07-21");
    expect(summary).toMatchObject({ learningDays7: 0, learningDays30: 0, reviews30: 0, topicsLearned30: 0 });
    expect(summary.today).toMatchObject({ day: "2026-07-21", score: 0, isFuture: false });
    expect(summary.days.at(-1)).toMatchObject({ day: "2026-07-25", score: 0, isFuture: true });
  });
});

describe("activity calendar layout", () => {
  it("returns complete Sunday-to-Saturday week columns", () => {
    const range = activityCalendarRange("2026-07-21", 3);
    expect(range).toEqual({ start: "2026-07-05", end: "2026-07-25" });
    const summary = buildActivitySummary([], range.start, range.end, "2026-07-21");
    const weeks = activityWeeks(summary.days);
    expect(weeks).toHaveLength(3);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("crosses leap day without losing a calendar cell", () => {
    const range = activityCalendarRange("2028-03-01", 2);
    const summary = buildActivitySummary([], range.start, range.end, "2028-03-01");
    expect(summary.days.map((day) => day.day)).toContain("2028-02-29");
    expect(summary.days).toHaveLength(14);
  });
});
