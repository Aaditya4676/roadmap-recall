import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";
import type { ReviewState } from "@/lib/domain/types";
import {
  buildRecallAnswerSnapshots,
  MAX_RECALL_ANSWER_CHARS,
  MAX_RECALL_QUESTIONS,
  MAX_RECALL_TOTAL_CHARS,
  readRecallAnswerSnapshots,
  readRecallQuestions,
} from "@/lib/recall";
import { scheduleReview } from "@/lib/scheduler";

const schema = z.object({
  rating: z.enum(["again", "hard", "good", "easy"]),
  expectedReviewCount: z.number().int().nonnegative(),
  scratchpad: z.string().max(20_000).default(""),
  appendScratchpad: z.boolean().default(false),
  recallAnswers: z.array(z.object({
    questionId: z.string().uuid(),
    answer: z.string().max(MAX_RECALL_ANSWER_CHARS),
  })).max(MAX_RECALL_QUESTIONS).superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.questionId)) context.addIssue({ code: "custom", path: [index, "questionId"], message: "Each recall question can only be answered once." });
      seen.add(item.questionId);
    });
    if (items.reduce((total, item) => total + item.answer.length, 0) > MAX_RECALL_TOTAL_CHARS) {
      context.addIssue({ code: "custom", message: "Recall answers are too large for one review." });
    }
  }).default([]),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireOwnerRequest(request);
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const [{ data: topic, error: topicError }, { data: profile, error: profileError }] = await Promise.all([
      db.from("study_topics").select("keep_warm_days, personal_notes(recall_questions), review_states(*)").eq("id", id).single(),
      db.from("profiles").select("time_zone").eq("id", user.id).single(),
    ]);
    if (topicError || !topic) throw new HttpError(404, "Topic not found.", "not_found");
    if (profileError) throw profileError;
    const row = Array.isArray(topic.review_states) ? topic.review_states[0] : topic.review_states;
    const note = Array.isArray(topic.personal_notes) ? topic.personal_notes[0] : topic.personal_notes;
    if (!note) throw new HttpError(409, "This topic is missing its personal-note record.", "missing_personal_note");
    const current: ReviewState = {
      scheduler: row.scheduler, dueAt: row.due_at, dueOn: row.due_on,
      lastReviewedAt: row.last_reviewed_at, reviewCount: row.review_count,
      fixedStage: row.fixed_stage, fsrsCard: row.fsrs_card,
      latestRecallAnswers: readRecallAnswerSnapshots(row.latest_recall_answers),
    };
    if (current.reviewCount !== body.expectedReviewCount) throw new HttpError(409, "Review state changed. Reload this session.", "revision_conflict");
    let recallAnswers;
    try {
      recallAnswers = buildRecallAnswerSnapshots(readRecallQuestions(note.recall_questions), body.recallAnswers);
    } catch (error) {
      throw new HttpError(409, error instanceof Error ? error.message : "Recall questions changed. Reload this review.", "recall_questions_changed");
    }
    const reviewedAt = new Date();
    const next = {
      ...scheduleReview(current, body.rating, reviewedAt, topic.keep_warm_days, profile.time_zone),
      latestRecallAnswers: recallAnswers,
    };
    const { error } = await db.rpc("record_topic_review_v2", {
      p_topic_id: id,
      p_expected_review_count: body.expectedReviewCount,
      p_rating: body.rating,
      p_reviewed_at: reviewedAt.toISOString(),
      p_previous_due_on: current.dueOn,
      p_next_state: next,
      p_scratchpad: body.scratchpad,
      p_append_scratchpad: body.appendScratchpad,
      p_recall_answers: recallAnswers,
    });
    if (error?.code === "40001") throw new HttpError(409, "Review state changed. Reload this session.", "revision_conflict");
    if (error) throw error;
    return Response.json({ reviewState: next });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({
        error: {
          code: "invalid_body",
          message: error.issues[0]?.message ?? "Check the submitted review.",
          issues: error.issues,
        },
      }, { status: 400 });
    }
    return errorResponse(error);
  }
}
