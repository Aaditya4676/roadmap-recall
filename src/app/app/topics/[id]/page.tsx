import { CalendarClock, Layers3 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiNotePanel } from "@/components/ai-note-panel";
import { NoteEditor } from "@/components/note-editor";
import { humanDate } from "@/lib/date";
import { getTopic } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createServerSupabase();
  const topic = await getTopic(db, id);
  if (!topic) notFound();
  const isPersonal = topic.breadcrumb === "Personal topics";
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/library" className="button-ghost mb-5 !px-0">← Back to Library</Link>
      <div className="page-heading mb-8">
        <p className="context-label">{isPersonal ? "Personal topic" : topic.part === "frontend" ? "Primary plan" : "Extension plan"}</p>
        <h1 className="mt-2 text-balance text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{topic.title}</h1>
        <p className="mt-2 text-[var(--muted)]">{topic.breadcrumb}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[color:var(--surface)]/60 px-2.5 py-1"><CalendarClock size={14} /> Due {humanDate(topic.reviewState.dueOn)}</span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[color:var(--surface)]/60 px-2.5 py-1 capitalize"><Layers3 size={14} /> {topic.scheduler} scheduler</span>
          <span className="rounded-md border border-[var(--border)] bg-[color:var(--surface)]/60 px-2.5 py-1 capitalize">{topic.kind}</span>
        </div>
      </div>
      <NoteEditor topicId={topic.id} initialMarkdown={topic.note.markdown} initialRevision={topic.note.revision} />
      <AiNotePanel topicId={topic.id} note={topic.aiNote} personalRevision={topic.note.revision} />
    </div>
  );
}
