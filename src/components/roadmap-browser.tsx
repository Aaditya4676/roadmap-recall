"use client";

import { Check, ChevronDown, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CaptureTopic } from "@/components/capture-topic";

export interface CatalogSection {
  id: string;
  section_number: number;
  title: string;
  part: "frontend" | "fullstack";
  roadmap_items: Array<{ id: string; title: string; priority: string | null; kind: string; active: boolean; source_ordinal: number }>;
}

export function RoadmapBrowser({ sections }: { sections: CatalogSection[] }) {
  const [query, setQuery] = useState("");
  const [part, setPart] = useState<"all" | "frontend" | "fullstack">("all");
  const [onlyActive, setOnlyActive] = useState(false);
  const filtered = useMemo(() => sections.filter((section) => part === "all" || section.part === part).map((section) => ({ ...section, roadmap_items: section.roadmap_items.filter((item) => (!onlyActive || item.active) && `${item.title} ${section.title}`.toLowerCase().includes(query.toLowerCase())) })).filter((section) => section.roadmap_items.length), [sections, query, part, onlyActive]);
  return (
    <>
      <div className="liquid-panel mb-6 grid gap-3 rounded-[12px] p-4 sm:grid-cols-[1fr_auto_auto]" data-liquid>
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <span className="sr-only">Search learning plan</span>
          <input className="field !pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics…" />
        </label>
        <label className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
          <select className="field !pl-9" value={part} onChange={(e) => setPart(e.target.value as typeof part)}>
            <option value="all">All parts</option>
            <option value="frontend">Primary plan</option>
            <option value="fullstack">Extension plan</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[color:var(--surface-strong)]/80 px-3 text-sm font-semibold">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} /> Active only
        </label>
      </div>
      {!sections.length && <div className="content-surface p-8 text-center"><h2 className="text-xl font-bold">Your plan is empty</h2><p className="mt-2 text-[var(--muted)]">Import a learning plan when you are ready. Personal topics still belong in Library.</p></div>}
      {filtered.map((section) => (
        <details className="content-surface group mb-4 overflow-hidden" key={section.id} open={Boolean(query)}>
          <summary className="flex cursor-pointer list-none items-center gap-4 p-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[color:var(--accent-soft)]/55 font-bold text-[var(--accent)]">{section.section_number}</span>
            <span className="min-w-0 flex-1"><span className="block font-bold">{section.title}</span><span className="text-xs text-[var(--muted)]">{section.roadmap_items.length} visible · {section.part === "frontend" ? "Primary plan" : "Extension plan"}</span></span>
            <ChevronDown className="transition group-open:rotate-180" size={18} />
          </summary>
          <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {section.roadmap_items.sort((a, b) => a.source_ordinal - b.source_ordinal).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-3 p-4 pl-5 sm:pl-[5.25rem]">
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.title}</span><span className="mt-1 flex gap-2 text-xs text-[var(--muted)]"><span>{item.priority ?? "Unranked"}</span><span>·</span><span className="capitalize">{item.kind}</span></span></span>
                {item.active ? <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent)]"><Check size={14} /> Active</span> : (item.kind === "knowledge" || item.kind === "drill") ? <CaptureTopic roadmapItemId={item.id} initialTitle={item.title} label="I learned this" /> : <span className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]">Catalog only</span>}
              </div>
            ))}
          </div>
        </details>
      ))}
    </>
  );
}
