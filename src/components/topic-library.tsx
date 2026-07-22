"use client";

import { BookOpen, ChevronRight, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { humanDate } from "@/lib/date";
import type { LibraryTopicSummary } from "@/lib/domain/topic-summary";

type SourceFilter = "all" | "personal" | "plan";
type SortOrder = "recent" | "review" | "title";

export function TopicLibrary({ topics, today }: { topics: LibraryTopicSummary[]; today: string }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [sort, setSort] = useState<SortOrder>("recent");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics
      .filter((topic) => source === "all" || topic.source === source)
      .filter((topic) => !needle || `${topic.title} ${topic.breadcrumb} ${topic.kind}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sort === "review") return a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title);
        if (sort === "title") return a.title.localeCompare(b.title);
        return b.activatedAt.localeCompare(a.activatedAt);
      });
  }, [query, sort, source, topics]);

  if (!topics.length) {
    return (
      <section className="content-surface p-8 text-center">
        <BookOpen className="mx-auto text-[var(--muted)]" size={30} />
        <h2 className="mt-3 text-xl font-bold">Your library is empty</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Add the first topic after you learn it. It will remain here between reviews.</p>
      </section>
    );
  }

  return (
    <>
      <div className="content-surface mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_180px_180px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <span className="sr-only">Search saved topics</span>
          <input className="field !pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved topics…" />
        </label>
        <label>
          <span className="sr-only">Filter by source</span>
          <select className="field" value={source} onChange={(event) => setSource(event.target.value as SourceFilter)}>
            <option value="all">All sources</option>
            <option value="personal">Personal topics</option>
            <option value="plan">From the plan</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Sort topics</span>
          <select className="field" value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}>
            <option value="recent">Recently added</option>
            <option value="review">Next review</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>

      <p className="mb-3 text-sm text-[var(--muted)]" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "topic" : "topics"}
      </p>

      {filtered.length ? (
        <section className="content-surface divide-y divide-[var(--border)] overflow-hidden" aria-label="Saved topics">
          {filtered.map((topic) => {
            const due = topic.dueOn <= today;
            const reviewLabel = topic.dueOn < today
              ? `Review overdue · ${humanDate(topic.dueOn)}`
              : topic.dueOn === today ? "Review today" : `Review ${humanDate(topic.dueOn)}`;
            return (
              <Link
                key={topic.id}
                href={`/app/topics/${topic.id}`}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-[color:var(--subtle)]/65 sm:px-5"
              >
                <BookOpen className="shrink-0 text-[var(--muted)]" size={18} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{topic.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted)]">
                    <span>{topic.source === "personal" ? "Personal topic" : topic.breadcrumb}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{topic.kind}</span>
                    <span aria-hidden="true">·</span>
                    <span>Learned {humanDate(topic.learnedOn)}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {topic.hasVisibleAiNote && <Sparkles className="text-[var(--plum)]" size={15} aria-label="AI notes available" />}
                  <span className={`hidden text-xs font-semibold sm:block ${due ? "text-[var(--coral)]" : "text-[var(--muted)]"}`}>{reviewLabel}</span>
                  <ChevronRight className="text-[var(--muted)]" size={17} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className="content-surface p-8 text-center">
          <h2 className="font-bold">No matching topics</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Try a different search or source filter.</p>
        </section>
      )}
    </>
  );
}
