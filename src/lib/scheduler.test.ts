import { describe, expect, it } from "vitest";
import { addCalendarDays, dateKey, zonedNoonTimestamp } from "@/lib/date";
import { createReviewState, createReviewStateFromDay, fixedIntervalDays, replayScheduler, scheduleReview } from "@/lib/scheduler";

describe("fixed scheduler", () => {
  it("uses 1 day, 7 days, 30 days, then keep-warm", () => {
    const learned = new Date("2026-07-20T05:00:00Z");
    let state = createReviewState("fixed", learned);
    expect(state.dueOn).toBe("2026-07-21");

    state = scheduleReview(state, "good", new Date("2026-07-21T05:00:00Z"), 14);
    expect(state.dueOn).toBe("2026-07-28");
    state = scheduleReview(state, "good", new Date("2026-07-28T05:00:00Z"), 14);
    expect(state.dueOn).toBe("2026-08-27");
    state = scheduleReview(state, "good", new Date("2026-08-27T05:00:00Z"), 14);
    expect(state.dueOn).toBe("2026-09-10");
  });

  it("does not advance a stage for Again or Hard", () => {
    expect(fixedIntervalDays({ fixedStage: 1 }, "again", null)).toEqual({ days: 1, nextStage: 1 });
    expect(fixedIntervalDays({ fixedStage: 1 }, "hard", null)).toEqual({ days: 15, nextStage: 1 });
  });
});

describe("scheduler migration", () => {
  it("replays history and maps Easy to Good for fixed", () => {
    const state = replayScheduler(
      "fixed",
      new Date("2026-07-20T05:00:00Z"),
      [{ reviewedAt: "2026-07-21T05:00:00Z", rating: "easy" }],
      null,
    );
    expect(state.fixedStage).toBe(1);
    expect(state.dueOn).toBe(addCalendarDays("2026-07-21", 7));
  });

  it("replays the same fixed history from the immutable learned calendar day", () => {
    const events = [
      { reviewedAt: "2026-07-21T18:00:00Z", rating: "good" as const },
      { reviewedAt: "2026-07-28T18:00:00Z", rating: "hard" as const },
      { reviewedAt: "2026-08-12T18:00:00Z", rating: "good" as const },
    ];
    let incremental = createReviewStateFromDay("fixed", "2026-07-20");
    for (const event of events) incremental = scheduleReview(incremental, event.rating, new Date(event.reviewedAt), 30, "America/Los_Angeles");
    const replayed = replayScheduler("fixed", "2026-07-20", events, 30, "America/Los_Angeles");
    expect(replayed).toEqual(incremental);
  });
});

describe("learned-day anchoring", () => {
  it.each(["Asia/Kolkata", "UTC", "America/Los_Angeles", "Pacific/Kiritimati"])("keeps first due date at learned day + 1 in %s", (timeZone) => {
    const state = createReviewStateFromDay("fsrs", "2026-07-20", timeZone);
    expect(state.dueOn).toBe("2026-07-21");
    expect(dateKey(state.dueAt, timeZone)).toBe("2026-07-21");
    expect(dateKey(zonedNoonTimestamp("2026-07-20", timeZone), timeZone)).toBe("2026-07-20");
  });
});

describe("FSRS adapter", () => {
  it("normalizes intraday results to a future owner calendar date", () => {
    const state = createReviewState("fsrs", new Date("2026-07-20T05:00:00Z"));
    const next = scheduleReview(state, "again", new Date("2026-07-21T05:00:00Z"), null);
    expect(next.dueOn > "2026-07-21").toBe(true);
    expect(next.fsrsCard?.due).toContain(next.dueOn);
  });

  it.each([
    ["again", 1],
    ["hard", 2],
    ["good", 3],
    ["easy", 4],
  ] as const)("keeps native %s scheduling exact at its integer anchor", (rating, grade) => {
    const reviewedAt = new Date("2026-07-21T05:00:00Z");
    const initial = createReviewState("fsrs", new Date("2026-07-20T05:00:00Z"));
    expect(scheduleReview(initial, rating, reviewedAt, null, "Asia/Kolkata", grade))
      .toEqual(scheduleReview(initial, rating, reviewedAt, null, "Asia/Kolkata"));
  });

  it("uses fractional AI evidence between adjacent native outcomes", () => {
    const initial = createReviewState("fsrs", new Date("2026-07-20T05:00:00Z"));
    const reviewedAt = new Date("2026-07-21T05:00:00Z");
    const hard = scheduleReview(initial, "hard", reviewedAt, null);
    const continuous = scheduleReview(initial, "good", reviewedAt, null, "Asia/Kolkata", 2.69);
    const good = scheduleReview(initial, "good", reviewedAt, null);
    expect(continuous.fsrsCard!.stability).toBeGreaterThan(hard.fsrsCard!.stability);
    expect(continuous.fsrsCard!.stability).toBeLessThan(good.fsrsCard!.stability);
    expect(continuous.fsrsCard!.difficulty).toBeLessThan(hard.fsrsCard!.difficulty);
    expect(continuous.fsrsCard!.difficulty).toBeGreaterThan(good.fsrsCard!.difficulty);
  });

  it("keeps continuous FSRS output finite and monotone across the grade axis", () => {
    const initial = createReviewState("fsrs", new Date("2026-07-20T05:00:00Z"));
    const reviewedAt = new Date("2026-07-21T05:00:00Z");
    let previousStability = 0;
    for (let grade = 1; grade <= 4; grade += 0.05) {
      const next = scheduleReview(initial, "good", reviewedAt, null, "Asia/Kolkata", grade);
      expect(Number.isFinite(next.fsrsCard!.stability)).toBe(true);
      expect(Number.isFinite(next.fsrsCard!.difficulty)).toBe(true);
      expect(next.fsrsCard!.difficulty).toBeGreaterThanOrEqual(1);
      expect(next.fsrsCard!.difficulty).toBeLessThanOrEqual(10);
      expect(next.fsrsCard!.stability).toBeGreaterThanOrEqual(previousStability);
      previousStability = next.fsrsCard!.stability;
    }
  });

  it("keeps a strong fractional first review valid for the next review", () => {
    const initial = createReviewState("fsrs", new Date("2026-07-20T05:00:00Z"));
    const first = scheduleReview(initial, "good", new Date("2026-07-21T05:00:00Z"), null, "Asia/Kolkata", 3.7);
    expect(first.fsrsCard!.difficulty).toBe(1);
    expect(() => scheduleReview(first, "good", new Date("2026-07-28T05:00:00Z"), null)).not.toThrow();
  });

  it.each([
    ["again", 1],
    ["hard", 2],
    ["good", 3],
    ["easy", 4],
  ] as const)("keeps established-card %s anchors exact", (rating, grade) => {
    const initial = createReviewState("fsrs", new Date("2026-07-20T05:00:00Z"));
    const established = scheduleReview(initial, "good", new Date("2026-07-21T05:00:00Z"), null);
    const reviewedAt = new Date("2026-07-28T05:00:00Z");
    expect(scheduleReview(established, rating, reviewedAt, null, "Asia/Kolkata", grade))
      .toEqual(scheduleReview(established, rating, reviewedAt, null, "Asia/Kolkata"));
  });

  it("orders mixed-precision timestamps by instant and then id", () => {
    const events = [
      { id: "c", reviewedAt: "2026-07-21T05:00:00.5Z", rating: "good" as const, continuousGrade: 2.7 },
      { id: "a", reviewedAt: "2026-07-21T05:00:00Z", rating: "hard" as const, continuousGrade: 2.1 },
      { id: "b", reviewedAt: "2026-07-21T05:00:00.25Z", rating: "good" as const, continuousGrade: 2.4 },
    ];
    let incremental = createReviewStateFromDay("fsrs", "2026-07-20");
    for (const event of [events[1], events[2], events[0]]) {
      incremental = scheduleReview(incremental, event.rating, new Date(event.reviewedAt), null, "Asia/Kolkata", event.continuousGrade);
    }
    expect(replayScheduler("fsrs", "2026-07-20", events, null)).toEqual(incremental);
  });

  it("ignores continuous evidence for the fixed scheduler", () => {
    const initial = createReviewState("fixed", new Date("2026-07-20T05:00:00Z"));
    const reviewedAt = new Date("2026-07-21T05:00:00Z");
    expect(scheduleReview(initial, "good", reviewedAt, null, "Asia/Kolkata", 2.69))
      .toEqual(scheduleReview(initial, "good", reviewedAt, null, "Asia/Kolkata"));
  });
});
