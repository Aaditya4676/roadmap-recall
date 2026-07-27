import { z } from "zod";
import type { ReviewRating } from "@/lib/domain/types";

export const recallJudgmentDocumentSchema = z.object({
  results: z.array(z.object({
    questionId: z.string().uuid(),
    score: z.number().int().min(0).max(4),
    feedback: z.string().trim().min(1).max(500),
  })).min(1).max(50),
  summary: z.string().trim().min(1).max(800),
});

export type RecallJudgmentDocument = z.infer<typeof recallJudgmentDocumentSchema>;

export const recallAssessmentSchema = recallJudgmentDocumentSchema.extend({
  retainedPercent: z.number().int().min(0).max(100),
  recommendedRating: z.enum(["again", "hard", "good", "easy"]),
  provider: z.enum(["gemini", "zai"]),
  model: z.string().trim().min(1).max(120),
});

export type RecallAssessment = z.infer<typeof recallAssessmentSchema>;

export function ratingFromRecallScore(score: number): ReviewRating {
  if (score < 1.5) return "again";
  if (score < 2.5) return "hard";
  if (score < 3.75) return "good";
  return "easy";
}

export function completeRecallAssessment(
  document: RecallJudgmentDocument,
  provider: RecallAssessment["provider"],
  model: string,
): RecallAssessment {
  const average = document.results.reduce((total, item) => total + item.score, 0) / document.results.length;
  return {
    ...document,
    retainedPercent: Math.round((average / 4) * 100),
    recommendedRating: ratingFromRecallScore(average),
    provider,
    model,
  };
}
