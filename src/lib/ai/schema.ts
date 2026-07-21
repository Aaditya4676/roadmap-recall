import { z } from "zod";

const short = z.string().trim().min(1).max(2_000);
export const aiNoteDocumentSchema = z.object({
  summary: z.string().trim().min(1).max(4_000),
  keyPoints: z.array(short).min(1).max(12),
  mentalModel: z.string().trim().min(1).max(3_000).optional(),
  pitfalls: z.array(short).max(10).default([]),
  recallQuestions: z.array(z.object({ question: short, answer: short.optional() })).max(10).default([]),
  practiceIdeas: z.array(short).max(10).default([]),
  connections: z.array(short).max(10).default([]),
  gapsOrUncertainties: z.array(short).max(8).optional(),
});

export const aiUpsertSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  sourceNoteRevision: z.number().int().positive(),
  document: aiNoteDocumentSchema,
  model: z.string().trim().min(1).max(120),
});

export type AiNoteInput = z.infer<typeof aiNoteDocumentSchema>;
