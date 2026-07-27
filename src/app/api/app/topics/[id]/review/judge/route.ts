import { NextRequest } from "next/server";
import { z } from "zod";
import { judgeRecall } from "@/lib/ai/recall-judge";
import { withRecallJudgeQuota } from "@/lib/ai/recall-judge-quota";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";
import {
  MAX_RECALL_ANSWER_CHARS,
  MAX_RECALL_QUESTIONS,
  MAX_RECALL_TOTAL_CHARS,
  readRecallQuestions,
  readyRecallQuestions,
} from "@/lib/recall";

export const maxDuration = 120;

const schema = z.object({
  provider: z.enum(["gemini", "zai"]),
  consent: z.literal(true),
  expectedNoteRevision: z.number().int().positive(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    answer: z.string().max(MAX_RECALL_ANSWER_CHARS),
  })).min(1).max(MAX_RECALL_QUESTIONS).superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.questionId)) context.addIssue({ code: "custom", path: [index, "questionId"], message: "Each question can only be judged once." });
      seen.add(item.questionId);
    });
    if (items.reduce((total, item) => total + item.answer.length, 0) > MAX_RECALL_TOTAL_CHARS) {
      context.addIssue({ code: "custom", message: "Recall answers are too large to judge." });
    }
  }),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireOwnerRequest(request);
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const { data: topic, error } = await db
      .from("study_topics")
      .select("personal_notes(recall_questions, revision)")
      .eq("id", id)
      .single();
    if (error || !topic) throw new HttpError(404, "Topic not found.", "not_found");
    const note = Array.isArray(topic.personal_notes) ? topic.personal_notes[0] : topic.personal_notes;
    if (!note) throw new HttpError(409, "This topic is missing its personal-note record.", "missing_personal_note");
    if (note.revision !== body.expectedNoteRevision) {
      throw new HttpError(409, "Recall questions changed. Reload this review before using the AI judge.", "revision_conflict");
    }

    const questions = readyRecallQuestions(readRecallQuestions(note.recall_questions));
    const questionById = new Map(questions.map((item) => [item.id, item]));
    if (body.answers.length !== questions.length || body.answers.some((item) => !questionById.has(item.questionId))) {
      throw new HttpError(409, "Recall questions changed. Reload this review before using the AI judge.", "recall_questions_changed");
    }
    const judgmentItems = body.answers.map((item) => {
      const question = questionById.get(item.questionId)!;
      return { ...question, questionId: question.id, answer: item.answer };
    });
    const assessment = await withRecallJudgeQuota({
      db,
      user,
      topicId: id,
      provider: body.provider,
      operation: () => judgeRecall(body.provider, judgmentItems),
    });
    return Response.json({ assessment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: { code: "invalid_body", message: error.issues[0]?.message, issues: error.issues } }, { status: 400 });
    }
    const providerCode = (error as { code?: string })?.code;
    if (providerCode === "provider_not_configured") {
      return errorResponse(new HttpError(503, error instanceof Error ? error.message : "The selected AI provider is not configured.", providerCode));
    }
    if (["provider_auth", "provider_quota", "provider_error", "provider_timeout", "empty_response", "invalid_response"].includes(providerCode ?? "")) {
      const message = providerCode === "provider_quota"
        ? "The selected AI provider is rate-limited or out of quota. Rate manually or try later."
        : providerCode === "provider_auth"
          ? "The selected AI provider rejected its API key. Check the server configuration or rate manually."
          : providerCode === "provider_timeout"
            ? "The AI judge timed out. Rate manually or try again."
            : "The selected AI provider could not judge this attempt. Rate manually or try again.";
      return errorResponse(new HttpError(502, message, providerCode ?? "provider_error"));
    }
    return errorResponse(error);
  }
}
