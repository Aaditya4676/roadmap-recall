import { ActivityView, type CompletedReviewItem } from "@/components/activity-view";
import { recallAssessmentSchema } from "@/lib/ai/recall-judge-schema";
import { activityCalendarRange, buildActivitySummary, type ActivityEvent } from "@/lib/activity";
import { dateKey } from "@/lib/date";
import { readRecallAnswerSnapshots } from "@/lib/recall";
import { createServerSupabase, getAuthenticatedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ActivityEventRow {
  event_kind: "learned" | "reviewed";
  topic_id: string;
  event_on: string;
  previous_due_on: string | null;
}

interface CompletedReviewRow {
  id: string;
  topic_id: string;
  reviewed_on: string;
  rating: CompletedReviewItem["rating"];
  recall_answers: unknown;
  ai_assessment: unknown;
  study_topics: { title: string; breadcrumb: string } | Array<{ title: string; breadcrumb: string }>;
}

export default async function ActivityPage() {
  const db = await createServerSupabase();
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("time_zone")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;

  const today = dateKey(new Date(), profile.time_zone);
  const range = activityCalendarRange(today);
  const [activityResult, completedResult] = await Promise.all([
    db.rpc("get_learning_activity_events", { p_from: range.start, p_to: today }),
    db.from("review_events")
      .select("id, topic_id, reviewed_on, rating, recall_answers, ai_assessment, study_topics(title, breadcrumb)")
      .order("reviewed_at", { ascending: false })
      .limit(50),
  ]);
  if (activityResult.error) throw activityResult.error;
  if (completedResult.error) throw completedResult.error;

  const events = ((activityResult.data ?? []) as ActivityEventRow[]).flatMap((row): ActivityEvent[] => {
    if (row.event_kind === "learned") {
      return [{ kind: "learned", topicId: row.topic_id, eventOn: row.event_on, previousDueOn: null }];
    }
    if (row.event_kind === "reviewed" && row.previous_due_on) {
      return [{ kind: "reviewed", topicId: row.topic_id, eventOn: row.event_on, previousDueOn: row.previous_due_on }];
    }
    return [];
  });

  const completedReviews = ((completedResult.data ?? []) as CompletedReviewRow[]).flatMap((row): CompletedReviewItem[] => {
    const answers = readRecallAnswerSnapshots(row.recall_answers);
    if (!answers.length) return [];
    const topic = Array.isArray(row.study_topics) ? row.study_topics[0] : row.study_topics;
    if (!topic) return [];
    const parsedAssessment = recallAssessmentSchema.safeParse(row.ai_assessment);
    return [{
      id: row.id,
      topicId: row.topic_id,
      title: topic.title,
      breadcrumb: topic.breadcrumb,
      reviewedOn: row.reviewed_on,
      rating: row.rating,
      answerCount: answers.length,
      hasAiJudgment: row.ai_assessment !== null,
      assessment: parsedAssessment.success ? parsedAssessment.data : null,
    }];
  });

  return <ActivityView summary={buildActivitySummary(events, range.start, range.end, today)} today={today} completedReviews={completedReviews} />;
}
