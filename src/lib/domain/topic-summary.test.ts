import { describe, expect, it } from "vitest";
import { mapLibraryTopicSummaryRow, mapTopicSummaryRow } from "@/lib/domain/topic-summary";

describe("topic summary mapping", () => {
  it("supports PostgREST to-one relation objects", () => {
    expect(mapTopicSummaryRow({
      id: "topic-1",
      title: "Active recall",
      breadcrumb: "Learning science",
      review_states: { due_on: "2026-07-22" },
      ai_notes: null,
    })).toMatchObject({ dueOn: "2026-07-22", hasVisibleAiNote: false });
  });

  it("also tolerates array-shaped relation mocks and finds visible AI notes", () => {
    expect(mapTopicSummaryRow({
      id: "topic-2",
      title: "Bayes' theorem",
      breadcrumb: "Probability",
      review_states: [{ due_on: "2026-07-23" }],
      ai_notes: [{ hidden: false }],
    })).toMatchObject({ dueOn: "2026-07-23", hasVisibleAiNote: true });
  });

  it("fails with an actionable invariant when a review state is missing", () => {
    expect(() => mapTopicSummaryRow({ id: "topic-3", review_states: null, ai_notes: null }))
      .toThrow("Topic topic-3 is missing a valid review state.");
  });

  it("maps manually captured topics into the personal library", () => {
    expect(mapLibraryTopicSummaryRow({
      id: "topic-4",
      title: "AbortController ownership",
      breadcrumb: "Personal topics",
      kind: "knowledge",
      learned_on: "2026-07-23",
      activated_at: "2026-07-23T06:30:00.000Z",
      scheduler: "fixed",
      roadmap_item_id: null,
      review_states: { due_on: "2026-07-24", review_count: 0 },
      ai_notes: null,
    })).toMatchObject({
      source: "personal",
      learnedOn: "2026-07-23",
      dueOn: "2026-07-24",
      reviewCount: 0,
    });
  });

  it("distinguishes activated plan items from personal captures", () => {
    expect(mapLibraryTopicSummaryRow({
      id: "topic-5",
      title: "Event loop",
      breadcrumb: "5. JavaScript",
      kind: "knowledge",
      learned_on: "2026-07-20",
      activated_at: "2026-07-20T06:30:00.000Z",
      scheduler: "fsrs",
      roadmap_item_id: "roadmap-item-1",
      review_states: [{ due_on: "2026-07-25", review_count: 2 }],
      ai_notes: [{ hidden: false }],
    })).toMatchObject({ source: "plan", scheduler: "fsrs", reviewCount: 2, hasVisibleAiNote: true });
  });
});
