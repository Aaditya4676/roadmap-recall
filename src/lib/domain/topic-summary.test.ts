import { describe, expect, it } from "vitest";
import { mapTopicSummaryRow } from "@/lib/domain/topic-summary";

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
});
