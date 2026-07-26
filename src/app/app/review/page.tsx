import { notFound } from "next/navigation";
import { ReviewSession } from "@/components/review-session";
import { dateKey } from "@/lib/date";
import { getTopic, getTopics } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedTopicId = typeof query.topic === "string" ? query.topic : null;
  const db = await createServerSupabase();
  if (requestedTopicId) {
    const topic = await getTopic(db, requestedTopicId);
    if (!topic) notFound();
    return <ReviewSession initialTopics={[topic]} mode="single" />;
  }
  const [{ data: profile }, topics] = await Promise.all([db.from("profiles").select("time_zone").single(), getTopics(db)]);
  const today = dateKey(new Date(), profile?.time_zone);
  return <ReviewSession initialTopics={topics.filter((topic) => topic.reviewState.dueOn <= today).sort((a, b) => a.reviewState.dueOn.localeCompare(b.reviewState.dueOn))} />;
}
