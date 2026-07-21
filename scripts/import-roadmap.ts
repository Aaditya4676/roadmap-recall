import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { matchImport, parseRoadmap, type ExistingImportItem } from "../src/lib/roadmap/parser";

loadEnvConfig(process.cwd());

const mode = process.argv.includes("--apply") ? "apply" : "preview";
const customPath = process.argv.find((argument) => argument.startsWith("--file="))?.slice(7);
const sourcePath = path.resolve(
  process.cwd(),
  customPath ?? process.env.ROADMAP_SOURCE_PATH ?? "../MASTER_FRONTEND_FULLSTACK_ROADMAP2.md",
);

async function main() {
  const markdown = await readFile(sourcePath, "utf8");
  const parsed = parseRoadmap(markdown);
  const sourceSha256 = createHash("sha256").update(markdown).digest("hex");

  console.log(`Source: ${sourcePath}`);
  console.log(`Scoped items: ${parsed.counts.total}`);
  console.log(`Frontend: ${parsed.counts.frontend}; full-stack extension: ${parsed.counts.fullstack}`);
  console.log(`Sections: ${parsed.sections.length}; SHA-256: ${sourceSha256}`);

  if (parsed.counts.total !== 795) {
    throw new Error(`Catalog gate failed: expected 795 scoped checkboxes, found ${parsed.counts.total}.`);
  }
  if (mode === "preview") return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!url || !serviceKey || !ownerEmail) {
    throw new Error("Apply requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OWNER_EMAIL.");
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id")
    .eq("email", ownerEmail)
    .maybeSingle();
  if (profileError || !profile) throw profileError ?? new Error(`No profile found for ${ownerEmail}.`);

  const { data: existingRows, error: existingError } = await db
    .from("roadmap_items")
    .select("id, source_locator, normalized_title, content_hash, roadmap_sections!inner(section_number)")
    .eq("owner_id", profile.id);
  if (existingError) throw existingError;

  const existing: ExistingImportItem[] = (existingRows ?? []).map((row: any) => ({
    id: row.id,
    sectionNumber: row.roadmap_sections.section_number,
    locator: row.source_locator,
    normalizedTitle: row.normalized_title,
    contentHash: row.content_hash,
  }));
  const matches = matchImport(parsed.items, existing);
  const summary = matches.reduce<Record<string, number>>((counts, match) => {
    counts[match.status] = (counts[match.status] ?? 0) + 1;
    return counts;
  }, {});
  console.log("Match preview:", summary);
  const ambiguous = matches.filter((match) => match.status === "ambiguous");
  if (ambiguous.length) {
    throw new Error(`${ambiguous.length} ambiguous matches require manual resolution; nothing was applied.`);
  }

  const { data: imported, error: importError } = await db
    .from("roadmap_imports")
    .insert({
      owner_id: profile.id,
      file_name: path.basename(sourcePath),
      source_sha256: sourceSha256,
      status: "preview",
      item_count: parsed.counts.total,
      frontend_count: parsed.counts.frontend,
      fullstack_count: parsed.counts.fullstack,
      preview: summary,
    })
    .select("id")
    .single();
  if (importError) throw importError;

  const { data: sectionRows, error: sectionError } = await db
    .from("roadmap_sections")
    .upsert(
      parsed.sections.map((section) => ({
        owner_id: profile.id,
        import_id: imported.id,
        section_number: section.sectionNumber,
        title: section.title,
        part: section.part,
        source_ordinal: section.ordinal,
      })),
      { onConflict: "owner_id,section_number" },
    )
    .select("id, section_number");
  if (sectionError) throw sectionError;
  const sectionIds = new Map(sectionRows!.map((row) => [row.section_number, row.id]));

  for (const match of matches) {
    if (match.status === "ambiguous") {
      throw new Error(`Ambiguous item escaped the preview gate: ${match.incoming.locator}`);
    }
    const item = match.incoming;
    const values = {
      owner_id: profile.id,
      section_id: sectionIds.get(item.sectionNumber),
      import_id: imported.id,
      heading_path: item.headingPath,
      source_ordinal: item.sourceOrdinal,
      source_locator: item.locator,
      title: item.title,
      normalized_title: item.normalizedTitle,
      raw_text: item.rawText,
      content_hash: item.contentHash,
      priority: item.priority,
      kind: item.kind,
    };
    const operation = match.status === "new"
      ? db.from("roadmap_items").insert({ ...values, active: false })
      : db.from("roadmap_items").update(values).eq("id", match.existingId);
    const { error } = await operation;
    if (error) {
      await db.from("roadmap_imports").update({ status: "failed", error_message: error.message }).eq("id", imported.id);
      throw error;
    }
  }

  const { error: finishError } = await db
    .from("roadmap_imports")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", imported.id);
  if (finishError) throw finishError;
  console.log(`Applied import ${imported.id}. Existing active study state was preserved.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
