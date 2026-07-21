import { ActivityView } from "@/components/activity-view";
import { activityCalendarRange, buildActivitySummary, type ActivityEvent } from "@/lib/activity";
import { dateKey } from "@/lib/date";
import { createServerSupabase, getAuthenticatedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ActivityEventRow {
  event_kind: "learned" | "reviewed";
  topic_id: string;
  event_on: string;
  previous_due_on: string | null;
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
  const { data, error } = await db.rpc("get_learning_activity_events", {
    p_from: range.start,
    p_to: today,
  });
  if (error) throw error;

  const events = ((data ?? []) as ActivityEventRow[]).flatMap((row): ActivityEvent[] => {
    if (row.event_kind === "learned") {
      return [{ kind: "learned", topicId: row.topic_id, eventOn: row.event_on, previousDueOn: null }];
    }
    if (row.event_kind === "reviewed" && row.previous_due_on) {
      return [{ kind: "reviewed", topicId: row.topic_id, eventOn: row.event_on, previousDueOn: row.previous_due_on }];
    }
    return [];
  });

  return <ActivityView summary={buildActivitySummary(events, range.start, range.end, today)} today={today} />;
}
