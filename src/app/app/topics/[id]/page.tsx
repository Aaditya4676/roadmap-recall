import { Brain, CalendarClock, Layers3 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiNotePanel } from "@/components/ai-note-panel";
import { NoteEditor } from "@/components/note-editor";
import { recallAssessmentSchema } from "@/lib/ai/recall-judge-schema";
import { humanDate } from "@/lib/date";
import { getTopic } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createServerSupabase();
  const [topic, { data: latestReview, error: latestReviewError }] = await Promise.all([
    getTopic(db, id),
    db
      .from("review_events")
      .select("reviewed_at, ai_assessment")
      .eq("topic_id", id)
      .order("reviewed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (latestReviewError) throw latestReviewError;
  if (!topic) notFound();
  const assessment = recallAssessmentSchema.safeParse(latestReview?.ai_assessment);
  const isLatestAttempt = latestReview
    && topic.reviewState.lastReviewedAt
    && new Date(latestReview.reviewed_at).getTime() === new Date(topic.reviewState.lastReviewedAt).getTime();
  const latestRecallGrades = assessment.success && isLatestAttempt ? assessment.data.results : [];
  const isPersonal = topic.breadcrumb === "Personal topics";
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/library" className="button-ghost !px-0">← Back to Library</Link>
        <Link href={`/app/review?topic=${topic.id}`} className="button-primary">
          <Brain size={17} /> Review now
        </Link>
      </div>
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
      <NoteEditor
        topicId={topic.id}
        initialMarkdown={topic.note.markdown}
        initialQuestions={topic.note.recallQuestions}
        initialRevision={topic.note.revision}
        latestRecallAnswers={topic.reviewState.latestRecallAnswers}
        latestRecallGrades={latestRecallGrades}
      />
      <AiNotePanel topicId={topic.id} note={topic.aiNote} personalRevision={topic.note.revision} />
    </div>
  );
}
