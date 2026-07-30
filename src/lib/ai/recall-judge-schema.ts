import { z } from "zod";
import type { ReviewRating } from "@/lib/domain/types";

export const recallJudgmentDocumentSchema = z.object({
  results: z.array(z.object({
    questionId: z.string().uuid(),
    score: z.number().min(0).max(10).multipleOf(0.5),
    feedback: z.string().trim().min(1).max(500),
  })).min(1).max(50),
  summary: z.string().trim().min(1).max(800),
});

export type RecallJudgmentDocument = z.infer<typeof recallJudgmentDocumentSchema>;

const storedRecallAssessmentSchema = recallJudgmentDocumentSchema.extend({
  retainedPercent: z.number().int().min(0).max(100),
  recommendedRating: z.enum(["again", "hard", "good", "easy"]),
  provider: z.enum(["gemini", "zai"]),
  model: z.string().trim().min(1).max(120),
  scoreScale: z.literal(10).optional(),
  meanScore: z.number().finite().min(0).max(10).optional(),
  continuousGrade: z.number().finite().min(1).max(4).optional(),
});

export const recallAssessmentSchema = storedRecallAssessmentSchema.transform((assessment) => {
  const results = assessment.scoreScale === 10
    ? assessment.results
    : assessment.results.map((result) => ({ ...result, score: result.score * 2.5 }));
  const meanScore = meanRecallScore(results);
  return {
    ...assessment,
    results,
    scoreScale: 10 as const,
    meanScore,
    continuousGrade: continuousGradeFromMean(meanScore),
    retainedPercent: Math.round(meanScore * 10),
    recommendedRating: ratingFromRecallScore(meanScore),
  };
});

export type RecallAssessment = z.output<typeof recallAssessmentSchema>;

export const LAPSE_GRADE_THRESHOLD = 1.5;

export function meanRecallScore(results: RecallJudgmentDocument["results"]): number {
  return results.reduce((total, item) => total + item.score, 0) / results.length;
}

export function continuousGradeFromMean(mean: number): number {
  if (Number.isFinite(mean) === false) throw new RangeError();
  return Math.min(4, Math.max(1, mean * 0.4));
}

export function ratingFromRecallScore(score: number): ReviewRating {
  if (score < 3.75) return "again";
  if (score < 6.25) return "hard";
  if (score < 9.375) return "good";
  return "easy";
}

export function completeRecallAssessment(
  document: RecallJudgmentDocument,
  provider: RecallAssessment["provider"],
  model: string,
): RecallAssessment {
  const meanScore = meanRecallScore(document.results);
  return {
    ...document,
    scoreScale: 10,
    meanScore,
    continuousGrade: continuousGradeFromMean(meanScore),
    retainedPercent: Math.round(meanScore * 10),
    recommendedRating: ratingFromRecallScore(meanScore),
    provider,
    model,
  };
}
