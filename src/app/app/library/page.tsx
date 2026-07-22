import { CaptureTopic } from "@/components/capture-topic";
import { PageHeading } from "@/components/page-heading";
import { TopicLibrary } from "@/components/topic-library";
import { dateKey } from "@/lib/date";
import { getLibraryTopicSummaries } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const db = await createServerSupabase();
  const [{ data: profile, error }, topics] = await Promise.all([
    db.from("profiles").select("time_zone").single(),
    getLibraryTopicSummaries(db),
  ]);
  if (error) throw error;

  return (
    <>
      <PageHeading
        title="Library"
        description="Every topic you have saved, whether it came from your plan or a quick capture."
        action={<CaptureTopic label="Add a topic" />}
      />
      <TopicLibrary topics={topics} today={dateKey(new Date(), profile.time_zone)} />
    </>
  );
}
