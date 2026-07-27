import { describe, expect, it } from "vitest";
import { completeRecallAssessment, ratingFromRecallScore } from "@/lib/ai/recall-judge-schema";

describe("recall judge scoring", () => {
  it("maps evidence scores to FSRS ratings", () => {
    expect(ratingFromRecallScore(0)).toBe("again");
    expect(ratingFromRecallScore(1.5)).toBe("hard");
    expect(ratingFromRecallScore(2.5)).toBe("good");
    expect(ratingFromRecallScore(3.75)).toBe("easy");
  });

  it("derives the retained percentage and rating in application code", () => {
    const assessment = completeRecallAssessment({
      results: [
        { questionId: "8acefc73-997a-4db5-a24a-afadf8799623", score: 3, feedback: "Mostly correct." },
        { questionId: "3ef54e20-7d09-4e99-8ea4-1f453227bbaa", score: 2, feedback: "One key gap." },
      ],
      summary: "Partial retention.",
    }, "zai", "glm-5.2");
    expect(assessment).toMatchObject({ retainedPercent: 63, recommendedRating: "good", provider: "zai", model: "glm-5.2" });
  });
});
