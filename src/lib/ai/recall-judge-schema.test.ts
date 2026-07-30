import { describe, expect, it } from "vitest";
import { completeRecallAssessment, continuousGradeFromMean, ratingFromRecallScore, recallAssessmentSchema, recallJudgmentDocumentSchema } from "@/lib/ai/recall-judge-schema";

describe("recall judge scoring", () => {
  it("maps evidence scores to FSRS ratings", () => {
    expect(ratingFromRecallScore(0)).toBe("again");
    expect(ratingFromRecallScore(3.75)).toBe("hard");
    expect(ratingFromRecallScore(6.25)).toBe("good");
    expect(ratingFromRecallScore(9.375)).toBe("easy");
  });

  it("derives the retained percentage and rating in application code", () => {
    const assessment = completeRecallAssessment({
      results: [
        { questionId: "8acefc73-997a-4db5-a24a-afadf8799623", score: 7.5, feedback: "Mostly correct." },
        { questionId: "3ef54e20-7d09-4e99-8ea4-1f453227bbaa", score: 5, feedback: "One key gap." },
      ],
      summary: "Partial retention.",
    }, "zai", "glm-5.2");
    expect(assessment).toMatchObject({ scoreScale: 10, meanScore: 6.25, continuousGrade: 2.5, retainedPercent: 63, recommendedRating: "good", provider: "zai", model: "glm-5.2" });
  });

  it("maps rubric means onto the continuous FSRS axis", () => {
    expect([0, 2.5, 5, 6.75, 7.5, 10].map(continuousGradeFromMean)).toEqual([1, 1, 2, 2.7, 3, 4]);
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
    expect(assessment).toMatchObject({ scoreScale: 10, meanScore: 5, continuousGrade: 2, results: [{ score: 5 }] });
  });

  it("keeps marked 10-point scores distinct from legacy scores", () => {
    const assessment = recallAssessmentSchema.parse({
      results: [{ questionId: "8acefc73-997a-4db5-a24a-afadf8799623", score: 3, feedback: "Minimal retention." }],
      summary: "Low retention.",
      retainedPercent: 30,
      recommendedRating: "again",
      provider: "gemini",
      model: "gemini-3.6-flash",
      scoreScale: 10,
    });
    expect(assessment).toMatchObject({ scoreScale: 10, meanScore: 3, retainedPercent: 30 });
    expect(assessment.continuousGrade).toBeCloseTo(1.2);
  });

  it("accepts only half-point increments from AI providers", () => {
    const base = {
      questionId: "8acefc73-997a-4db5-a24a-afadf8799623",
      feedback: "Specific feedback.",
    };
    expect(recallJudgmentDocumentSchema.safeParse({ results: [{ ...base, score: 7.5 }], summary: "Good." }).success).toBe(true);
    expect(recallJudgmentDocumentSchema.safeParse({ results: [{ ...base, score: 7.3 }], summary: "Invalid." }).success).toBe(false);
  });
});
