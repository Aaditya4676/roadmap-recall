import { CaptureTopic } from "@/components/capture-topic";
import { PageHeading } from "@/components/page-heading";
import { RoadmapBrowser, type CatalogSection } from "@/components/roadmap-browser";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const db = await createServerSupabase();
  const { data, error } = await db.from("roadmap_sections").select("id, section_number, title, part, roadmap_items(id, title, priority, kind, active, source_ordinal)").order("section_number");
  if (error) throw error;
  return <><PageHeading eyebrow="Master roadmap" title="Frontend first, full-stack separated" description="All catalog items begin inactive. Schedule only knowledge and drills after you actually learn them; projects, gates, and routines remain visible as guidance." action={<CaptureTopic label="Manual topic" />} /><RoadmapBrowser sections={(data ?? []) as CatalogSection[]} /></>;
}
