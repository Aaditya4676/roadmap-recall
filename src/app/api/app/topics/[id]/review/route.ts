import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";
import type { ReviewState } from "@/lib/domain/types";
import { scheduleReview } from "@/lib/scheduler";

const schema = z.object({
  rating: z.enum(["again", "hard", "good", "easy"]),
  expectedReviewCount: z.number().int().nonnegative(),
  scratchpad: z.string().max(20_000).default(""),
  appendScratchpad: z.boolean().default(false),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireOwnerRequest(request);
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const [{ data: topic, error: topicError }, { data: profile, error: profileError }] = await Promise.all([
      db.from("study_topics").select("keep_warm_days, review_states(*)").eq("id", id).single(),
      db.from("profiles").select("time_zone").eq("id", user.id).single(),
    ]);
    if (topicError || !topic) throw new HttpError(404, "Topic not found.", "not_found");
    if (profileError) throw profileError;
    const row = Array.isArray(topic.review_states) ? topic.review_states[0] : topic.review_states;
    const current: ReviewState = {
      scheduler: row.scheduler, dueAt: row.due_at, dueOn: row.due_on,
      lastReviewedAt: row.last_reviewed_at, reviewCount: row.review_count,
      fixedStage: row.fixed_stage, fsrsCard: row.fsrs_card,
    };
    if (current.reviewCount !== body.expectedReviewCount) throw new HttpError(409, "Review state changed. Reload this session.", "revision_conflict");
    const reviewedAt = new Date();
    const next = scheduleReview(current, body.rating, reviewedAt, topic.keep_warm_days, profile.time_zone);
    const { error } = await db.rpc("record_topic_review", {
      p_topic_id: id,
      p_expected_review_count: body.expectedReviewCount,
      p_rating: body.rating,
      p_reviewed_at: reviewedAt.toISOString(),
      p_previous_due_on: current.dueOn,
      p_next_state: next,
      p_scratchpad: body.scratchpad,
      p_append_scratchpad: body.appendScratchpad,
    });
    if (error?.code === "40001") throw new HttpError(409, "Review state changed. Reload this session.", "revision_conflict");
    if (error) throw error;
    return Response.json({ reviewState: next });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: { code: "invalid_body", issues: error.issues } }, { status: 400 });
    return errorResponse(error);
  }
}
