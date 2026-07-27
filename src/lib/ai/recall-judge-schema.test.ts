import { describe, expect, it } from "vitest";
import { completeRecallAssessment, continuousGradeFromMean, ratingFromRecallScore, recallAssessmentSchema } from "@/lib/ai/recall-judge-schema";

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
    expect(assessment).toMatchObject({ meanScore: 2.5, continuousGrade: 2.5, retainedPercent: 63, recommendedRating: "good", provider: "zai", model: "glm-5.2" });
  });

  it("maps rubric means onto the continuous FSRS axis", () => {
    expect([0, 1, 2, 2.69, 3, 4].map(continuousGradeFromMean)).toEqual([1, 1, 2, 2.69, 3, 4]);
    expect(() => continuousGradeFromMean(Number.NaN)).toThrow();
  });

  it("normalizes legacy stored assessments from their immutable result scores", () => {
    const assessment = recallAssessmentSchema.parse({
      results: [{ questionId: "8acefc73-997a-4db5-a24a-afadf8799623", score: 2, feedback: "Partial." }],
      summary: "Partial retention.",
      retainedPercent: 50,
      recommendedRating: "hard",
      provider: "gemini",
      model: "gemini-3.6-flash",
    });
    expect(assessment).toMatchObject({ meanScore: 2, continuousGrade: 2 });
  });
});
