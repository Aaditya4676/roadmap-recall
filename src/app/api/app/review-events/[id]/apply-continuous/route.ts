import { NextRequest } from "next/server";
import { recallAssessmentSchema } from "@/lib/ai/recall-judge-schema";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";
import type { ReviewState } from "@/lib/domain/types";
import { readRecallAnswerSnapshots } from "@/lib/recall";
import { replayScheduler } from "@/lib/scheduler";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireOwnerRequest(request);
    const { id } = await context.params;
    const { data: event, error: eventError } = await db
      .from("review_events")
      .select("id, topic_id, ai_assessment, continuous_grade")
      .eq("id", id)
      .single();
    if (eventError || !event) throw new HttpError(404, "Completed review not found.", "not_found");
    if (!event.ai_assessment) throw new HttpError(409, "This review has no AI judgment.", "not_judged");
    if (event.continuous_grade !== null) throw new HttpError(409, "This review already uses continuous scheduling.", "already_applied");
    const parsed = recallAssessmentSchema.safeParse(event.ai_assessment);
    if (!parsed.success) throw new HttpError(409, "The stored AI judgment is invalid.", "invalid_assessment");
    const assessment = parsed.data;

    const [topicResult, profileResult, historyResult] = await Promise.all([
      db.from("study_topics").select("learned_on, keep_warm_days, review_states(*)").eq("id", event.topic_id).single(),
      db.from("profiles").select("time_zone").eq("id", user.id).single(),
      db.from("review_events").select("id, reviewed_at, rating, continuous_grade").eq("topic_id", event.topic_id).order("reviewed_at", { ascending: true }).order("id", { ascending: true }),
    ]);
    if (topicResult.error || !topicResult.data) throw new HttpError(404, "Topic not found.", "not_found");
    if (profileResult.error || !profileResult.data) throw profileResult.error ?? new Error("Profile not found.");
    if (historyResult.error) throw historyResult.error;
    const row = Array.isArray(topicResult.data.review_states)
      ? topicResult.data.review_states[0]
      : topicResult.data.review_states;
    if (!row) throw new HttpError(409, "This topic is missing its review state.", "missing_review_state");
    const current: ReviewState = {
      scheduler: row.scheduler,
      dueAt: row.due_at,
      dueOn: row.due_on,
      lastReviewedAt: row.last_reviewed_at,
      reviewCount: row.review_count,
      fixedStage: row.fixed_stage,
      fsrsCard: row.fsrs_card,
      latestRecallAnswers: readRecallAnswerSnapshots(row.latest_recall_answers),
    };
    const history = (historyResult.data ?? []).map((item) => ({
      id: item.id,
      reviewedAt: item.reviewed_at,
      rating: item.rating,
      continuousGrade: item.id === id ? assessment.continuousGrade : item.continuous_grade,
    }));
    if (history.length !== current.reviewCount || !history.some((item) => item.id === id)) {
      throw new HttpError(409, "Review history changed. Retry the upgrade.", "revision_conflict");
    }
    const replayed = {
      ...replayScheduler(
        current.scheduler,
        topicResult.data.learned_on,
        history,
        topicResult.data.keep_warm_days,
        profileResult.data.time_zone,
      ),
      latestRecallAnswers: current.latestRecallAnswers,
    };
    const { error: applyError } = await db.rpc("apply_existing_ai_continuous_grade", {
      p_event_id: id,
      p_expected_review_count: current.reviewCount,
      p_ai_assessment: assessment,
      p_continuous_grade: assessment.continuousGrade,
      p_next_state: replayed,
    });
    if (applyError?.code === "40001") throw new HttpError(409, "Review history changed or this review was already upgraded. Refresh and retry.", "revision_conflict");
    if (applyError) throw applyError;
    return Response.json({ assessment, reviewState: replayed });
  } catch (error) {
    return errorResponse(error);
  }
}
