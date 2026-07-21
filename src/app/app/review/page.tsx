import { ReviewSession } from "@/components/review-session";
import { dateKey } from "@/lib/date";
import { getTopics } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const db = await createServerSupabase();
  const [{ data: profile }, topics] = await Promise.all([db.from("profiles").select("time_zone").single(), getTopics(db)]);
  const today = dateKey(new Date(), profile?.time_zone);
  return <ReviewSession initialTopics={topics.filter((topic) => topic.reviewState.dueOn <= today).sort((a, b) => a.reviewState.dueOn.localeCompare(b.reviewState.dueOn))} />;
}
