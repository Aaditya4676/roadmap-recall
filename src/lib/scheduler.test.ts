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
});
