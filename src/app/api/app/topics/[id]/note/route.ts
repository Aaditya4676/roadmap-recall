import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";
import {
  MAX_RECALL_ANSWER_CHARS,
  MAX_RECALL_QUESTION_CHARS,
  MAX_RECALL_QUESTIONS,
  MAX_RECALL_TOTAL_CHARS,
} from "@/lib/recall";

const recallQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string().max(MAX_RECALL_QUESTION_CHARS),
  idealAnswer: z.string().max(MAX_RECALL_ANSWER_CHARS),
});
const recallQuestionsSchema = z.array(recallQuestionSchema).max(MAX_RECALL_QUESTIONS).superRefine((items, context) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Recall question IDs must be unique." });
    seen.add(item.id);
  });
  if (items.reduce((total, item) => total + item.question.length + item.idealAnswer.length, 0) > MAX_RECALL_TOTAL_CHARS) {
    context.addIssue({ code: "custom", message: "Recall questions are too large for one note." });
  }
});

const schema = z.object({
  markdown: z.string().max(100_000),
  recallQuestions: recallQuestionsSchema.optional(),
  expectedRevision: z.number().int().positive(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireOwnerRequest(request);
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const update: Record<string, unknown> = {
      markdown: body.markdown,
      revision: body.expectedRevision + 1,
    };
    if (body.recallQuestions) update.recall_questions = body.recallQuestions;
    const { data, error } = await db.from("personal_notes").update(update).eq("topic_id", id).eq("revision", body.expectedRevision).select("revision, updated_at").maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(409, "Your note changed in another tab or device. Reload before saving again.", "revision_conflict");
    return Response.json({ revision: data.revision, updatedAt: data.updated_at });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({
        error: {
          code: "invalid_body",
          message: error.issues[0]?.message ?? "Check the submitted note.",
          issues: error.issues,
        },
      }, { status: 400 });
    }
    return errorResponse(error);
  }
}
