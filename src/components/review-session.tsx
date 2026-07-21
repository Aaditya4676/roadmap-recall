"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Markdown } from "@/components/markdown";
import type { ReviewRating, StudyTopic } from "@/lib/domain/types";

export function ReviewSession({ initialTopics }: { initialTopics: StudyTopic[] }) {
  const router = useRouter();
  const [topics, setTopics] = useState(initialTopics);
  const [index, setIndex] = useState(0);
  const [scratchpad, setScratchpad] = useState("");
  const [append, setAppend] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [aiRevealed, setAiRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const topic = topics[index];
  if (!topic) return <div className="card mx-auto max-w-xl p-10 text-center"><CheckCircle2 size={44} className="mx-auto text-[var(--accent)]" /><h1 className="mt-4 text-3xl font-bold">Review complete</h1><p className="mt-2 text-[var(--muted)]">You recalled {topics.length} {topics.length === 1 ? "topic" : "topics"}. That is enough for today.</p><Link className="button-primary mt-7" href="/app/today" onClick={() => router.refresh()}>Return to Today</Link></div>;
  async function rate(rating: ReviewRating) {
    setSaving(true); setError("");
    const response = await fetch(`/api/app/topics/${topic.id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating, expectedReviewCount: topic.reviewState.reviewCount, scratchpad, appendScratchpad: append }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error?.message ?? "Could not save the review."); setSaving(false); return; }
    setTopics((current) => current.map((item) => item.id === topic.id ? { ...item, reviewState: data.reviewState } : item));
    setIndex((value) => value + 1); setScratchpad(""); setAppend(false); setRevealed(false); setAiRevealed(false); setSaving(false);
  }
  return <div className="mx-auto max-w-3xl"><div className="mb-5 flex items-center justify-between"><Link href="/app/today" className="button-ghost">← End session</Link><span className="text-sm text-[var(--muted)]">{index + 1} / {topics.length}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--subtle)]"><div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${(index / topics.length) * 100}%` }} /></div><article className="card mt-5 p-5 sm:p-8"><p className="eyebrow">Recall before reveal</p><h1 className="mt-2 text-balance text-3xl font-bold sm:text-4xl">{topic.title}</h1><p className="mt-1 text-sm text-[var(--muted)]">{topic.breadcrumb}</p><label className="mt-7 grid gap-2 font-semibold">What can you explain from memory?<textarea autoFocus className="field min-h-36 resize-y font-normal" value={scratchpad} onChange={(e) => setScratchpad(e.target.value)} placeholder="Use this space to reconstruct the idea…" /></label><label className="mt-3 flex items-start gap-2 text-sm text-[var(--muted)]"><input className="mt-1" type="checkbox" checked={append} onChange={(e) => setAppend(e.target.checked)} /> Append this scratchpad to my personal note after rating</label>{!revealed ? <button className="button-primary mt-6 w-full" onClick={() => setRevealed(true)}>Reveal my notes</button> : <><section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-5"><p className="eyebrow mb-3">My notes</p><Markdown>{topic.note.markdown || "_No note was captured._"}</Markdown></section>{topic.aiNote && !topic.aiNote.hidden && (!aiRevealed ? <button className="button-secondary mt-3 w-full" onClick={() => setAiRevealed(true)}><Sparkles size={17} /> Reveal separate AI notes</button> : <section className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] p-5"><p className="eyebrow mb-3">AI notes · {topic.aiNote.model}</p><p>{topic.aiNote.document.summary}</p><ul className="mt-3 list-disc pl-5">{topic.aiNote.document.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul></section>)}<p className="mb-2 mt-7 text-center text-sm font-bold">How well did you recall it?</p><div className={`grid gap-2 ${topic.scheduler === "fsrs" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>{(["again", "hard", "good", ...(topic.scheduler === "fsrs" ? ["easy"] : [])] as ReviewRating[]).map((rating) => <button disabled={saving} key={rating} className={rating === "good" ? "button-primary capitalize" : "button-secondary capitalize"} onClick={() => rate(rating)}>{rating}</button>)}</div>{error && <p role="alert" className="mt-4 text-center text-sm text-[var(--danger)]">{error}</p>}</>}</article></div>;
}
