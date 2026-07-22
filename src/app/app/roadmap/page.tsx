import { PageHeading } from "@/components/page-heading";
import { RoadmapBrowser, type CatalogSection } from "@/components/roadmap-browser";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const db = await createServerSupabase();
  const { data, error } = await db.from("roadmap_sections").select("id, section_number, title, part, roadmap_items(id, title, priority, kind, active, source_ordinal)").order("section_number");
  if (error) throw error;
  return <><PageHeading title="Plan" description="Your imported roadmap. Activate knowledge and drills only after you have studied them." /><RoadmapBrowser sections={(data ?? []) as CatalogSection[]} /></>;
}
