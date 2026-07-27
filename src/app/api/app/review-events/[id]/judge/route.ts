import { NextRequest } from "next/server";
import { z } from "zod";
import { judgeRecall } from "@/lib/ai/recall-judge";
import { withRecallJudgeQuota } from "@/lib/ai/recall-judge-quota";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";
import type { ReviewState } from "@/lib/domain/types";
import { readRecallAnswerSnapshots } from "@/lib/recall";
import { replayScheduler } from "@/lib/scheduler";

export const maxDuration = 120;

const schema = z.object({ provider: z.enum(["gemini", "zai"]), consent: z.literal(true) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireOwnerRequest(request);
    const { id } = await context.params;
    const { provider } = schema.parse(await request.json());
    const { data: event, error: eventError } = await db
      .from("review_events")
      .select("id, topic_id, rating, recall_answers, ai_assessment")
      .eq("id", id)
      .single();
    if (eventError || !event) throw new HttpError(404, "Completed review not found.", "not_found");
    if (event.ai_assessment) throw new HttpError(409, "This review already has an AI judgment.", "already_judged");
    const answers = readRecallAnswerSnapshots(event.recall_answers);
    if (!answers.length) throw new HttpError(409, "This review has no structured answers to judge.", "no_recall_answers");

    // All answers from this completed review are judged in one provider call.
    const assessment = await withRecallJudgeQuota({
      db,
      user,
      topicId: event.topic_id,
      reviewEventId: id,
      provider,
      operation: () => judgeRecall(provider, answers.map((item) => ({
        questionId: item.id,
        question: item.question,
        idealAnswer: item.idealAnswer,
        answer: item.answer,
      }))),
    });

    const [topicResult, profileResult, historyResult] = await Promise.all([
      db.from("study_topics").select("learned_on, keep_warm_days, review_states(*)").eq("id", event.topic_id).single(),
      db.from("profiles").select("time_zone").eq("id", user.id).single(),
      db.from("review_events").select("id, reviewed_at, rating").eq("topic_id", event.topic_id).order("reviewed_at", { ascending: true }).order("id", { ascending: true }),
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
    const appliedRating = current.scheduler === "fixed" && assessment.recommendedRating === "easy"
      ? "good"
      : assessment.recommendedRating;
    const history = (historyResult.data ?? []).map((item) => ({
      reviewedAt: item.reviewed_at,
      rating: item.id === id ? appliedRating : item.rating,
    }));
    if (history.length !== current.reviewCount || !historyResult.data?.some((item) => item.id === id)) {
      throw new HttpError(409, "Review history changed. Retry the AI judgment.", "revision_conflict");
    }
    const replayed = appliedRating === event.rating
      ? current
      : {
          ...replayScheduler(
            current.scheduler,
            topicResult.data.learned_on,
            history,
            topicResult.data.keep_warm_days,
            profileResult.data.time_zone,
          ),
          latestRecallAnswers: current.latestRecallAnswers,
        };
    const { error: applyError } = await db.rpc("apply_review_ai_judgment", {
      p_event_id: id,
      p_expected_review_count: current.reviewCount,
      p_rating: appliedRating,
      p_ai_assessment: assessment,
      p_next_state: replayed,
    });
    if (applyError?.code === "40001") throw new HttpError(409, "Review history changed or this review was already judged. Refresh and try again.", "revision_conflict");
    if (applyError) throw applyError;
    return Response.json({ assessment, appliedRating, reviewState: replayed });
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
        ? "The selected AI provider is rate-limited or out of quota. Try again later."
        : providerCode === "provider_auth"
          ? "The selected AI provider rejected its API key. Check the server configuration."
          : providerCode === "provider_timeout"
            ? "The AI judge timed out. Try again."
            : "The selected AI provider could not judge this completed review. Try again.";
      return errorResponse(new HttpError(502, message, providerCode ?? "provider_error"));
    }
    return errorResponse(error);
  }
}
