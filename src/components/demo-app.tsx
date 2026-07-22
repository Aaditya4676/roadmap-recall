"use client";

import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ActivityView } from "@/components/activity-view";
import { Markdown } from "@/components/markdown";
import { PageHeading } from "@/components/page-heading";
import { activityCalendarRange, buildActivitySummary } from "@/lib/activity";
import { createDemoActivityEvents, createDemoTopics } from "@/lib/demo-data";
import { dateKey, humanDate, isDue, isOverdue } from "@/lib/date";
import type { ReviewRating, StudyTopic } from "@/lib/domain/types";
import { createReviewState, scheduleReview } from "@/lib/scheduler";

const STORAGE_KEY = "roadmap-recall-demo-v2";
const LEGACY_STORAGE_KEY = "roadmap-recall-demo-v1";

function longDate(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date));
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${weekdays[value.getUTCDay()]}, ${date} ${months[month - 1]}`;
}

function Modal({ children, label, onClose }: { children: React.ReactNode; label: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-end p-0 sm:place-items-center sm:p-5" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="liquid-dialog max-h-[92vh] w-full overflow-y-auto rounded-t-xl p-5 sm:max-w-2xl sm:rounded-[12px] sm:p-7" data-liquid role="dialog" aria-modal="true" aria-label={label}>
        <div className="mb-5 flex justify-end"><button className="button-ghost !size-10 !p-0" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>
        {children}
      </section>
    </div>
  );
}

function Metric({ value, label, tone = "default" }: { value: string | number; label: string; tone?: "default" | "accent" }) {
  return <div className="flex min-w-0 flex-col px-3 py-4 sm:px-5"><dt className="order-2 mt-1 truncate text-xs text-[var(--muted)] sm:text-sm">{label}</dt><dd className={`order-1 truncate text-2xl font-bold tracking-tight sm:text-3xl ${tone === "accent" ? "text-[var(--accent)]" : ""}`}>{value}</dd></div>;
}

export function DemoApp() {
  const params = useSearchParams();
  const requestedView = params.get("view") ?? "today";
  const view = requestedView === "roadmap" ? "library" : requestedView;
  const [topics, setTopics] = useState<StudyTopic[]>(() => createDemoTopics());
  const [ready, setReady] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState<StudyTopic | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const legacy = stored ? null : localStorage.getItem(LEGACY_STORAGE_KEY);
        const saved = stored ?? legacy;
        if (saved) {
          setTopics(JSON.parse(saved));
          if (legacy) {
            localStorage.setItem(STORAGE_KEY, legacy);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        }
      } catch { /* a corrupt demo is recoverable from Settings */ }
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
  }, [ready, topics]);

  function reset() {
    setTopics(createDemoTopics());
    localStorage.removeItem(STORAGE_KEY);
  }

  if (!ready) {
    return <AppShell demo demoView={view}><div className="liquid-panel mx-auto max-w-xl rounded-[12px] p-8 text-center text-[var(--muted)]" data-liquid role="status">Opening the local sandbox…</div></AppShell>;
  }

  return (
    <AppShell demo demoView={view}>
      <div className="mb-5 rounded-lg border border-[color:var(--accent)]/25 bg-[color:var(--accent-soft)]/70 px-4 py-3 text-sm text-[var(--accent)]">
        <strong>Private sandbox:</strong> everything here stays in this browser. It never reads or writes the production database.
      </div>
      {view === "library" ? <DemoLibrary topics={topics} onSelect={setSelected} onCapture={() => setCaptureOpen(true)} />
        : view === "plan" ? <DemoPlan topics={topics} onSelect={setSelected} />
        : view === "activity" || view === "progress" ? <DemoActivity topics={topics} />
          : view === "settings" ? <DemoSettings onReset={reset} />
            : <DemoToday topics={topics} onStart={() => setReviewOpen(true)} onSelect={setSelected} onCapture={() => setCaptureOpen(true)} />}
      {captureOpen && <CaptureModal onClose={() => setCaptureOpen(false)} onSave={(topic) => { setTopics((current) => [topic, ...current]); setCaptureOpen(false); setSelected(topic); }} />}
      {reviewOpen && <ReviewModal topics={topics} onClose={() => setReviewOpen(false)} onUpdate={(next) => setTopics((current) => current.map((topic) => topic.id === next.id ? next : topic))} />}
      {selected && <TopicModal topic={topics.find((topic) => topic.id === selected.id) ?? selected} onClose={() => setSelected(null)} onUpdate={(next) => { setTopics((current) => current.map((topic) => topic.id === next.id ? next : topic)); setSelected(next); }} />}
    </AppShell>
  );
}

function DemoToday({ topics, onStart, onSelect, onCapture }: { topics: StudyTopic[]; onStart: () => void; onSelect: (topic: StudyTopic) => void; onCapture: () => void }) {
  const today = dateKey(new Date());
  const due = topics.filter((topic) => isDue(topic.reviewState.dueOn, today)).sort((a, b) => a.reviewState.dueOn.localeCompare(b.reviewState.dueOn));
  const overdue = due.filter((topic) => isOverdue(topic.reviewState.dueOn, today)).length;
  const upcoming = topics.filter((topic) => topic.reviewState.dueOn > today).sort((a, b) => a.reviewState.dueOn.localeCompare(b.reviewState.dueOn)).slice(0, 5);
  return (
    <>
      <PageHeading eyebrow={longDate(today)} title={due.length ? "A small set to revisit" : "You’re clear for today"} description="Recall first. Reveal notes second. Two minutes per topic is enough to keep momentum." action={<button className="button-secondary" onClick={onCapture}><Plus size={18} /> Add what I learned</button>} />
      <dl className="metric-strip grid grid-cols-3 divide-x divide-[var(--border)] border-y">
        <Metric value={due.length} label="due today" tone="accent" />
        <Metric value={overdue} label="carried forward" />
        <Metric value={`~${due.length * 2} min`} label="estimated review time" />
      </dl>
      <section className="liquid-panel mt-6 overflow-hidden rounded-[12px]" data-liquid>
        <div className="glass-divider flex flex-wrap items-center justify-between gap-4 border-b p-5 sm:p-6">
          <div><h2 className="text-xl font-bold">Today’s review</h2><p className="text-sm text-[var(--muted)]">No penalty for a late topic—it simply waits here.</p></div>
          <button className="button-primary" data-liquid disabled={!due.length} onClick={onStart}><Brain size={18} /> Start review <ArrowRight size={17} /></button>
        </div>
        {due.length ? <div className="divide-y divide-[var(--border)]">{due.map((topic) => <TopicRow key={topic.id} topic={topic} today={today} onClick={() => onSelect(topic)} />)}</div>
          : <div className="p-10 text-center"><CheckCircle2 className="mx-auto text-[var(--accent)]" size={34} /><p className="mt-3 font-semibold">Nothing needs attention right now.</p></div>}
      </section>
      <details className="content-surface mt-6 group">
        <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-bold sm:p-6">Next seven days <ChevronDown className="transition group-open:rotate-180" size={18} /></summary>
        <div className="border-t border-[var(--border)] p-5"><div className="grid gap-2">{upcoming.map((topic) => <button key={topic.id} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-left hover:bg-[var(--subtle)]" onClick={() => onSelect(topic)}><span className="font-medium">{topic.title}</span><span className="shrink-0 text-xs text-[var(--muted)]">{humanDate(topic.reviewState.dueOn)}</span></button>)}</div></div>
      </details>
    </>
  );
}

function TopicRow({ topic, today, onClick }: { topic: StudyTopic; today: string; onClick: () => void }) {
  const overdue = isOverdue(topic.reviewState.dueOn, today);
  return <button onClick={onClick} className="flex w-full items-center gap-4 p-4 text-left hover:bg-[var(--subtle)] sm:px-6"><BookOpen size={18} className="shrink-0 text-[var(--muted)]" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{topic.title}</span><span className="block truncate text-xs text-[var(--muted)]">{topic.breadcrumb}</span></span>{topic.aiNote && <Sparkles size={16} className="shrink-0 text-[var(--plum)]" aria-label="AI notes available" />}<span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${overdue ? "bg-[color:var(--coral)]/12 text-[var(--coral)]" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}>{overdue ? "Waiting" : "Today"}</span></button>;
}

function DemoLibrary({ topics, onSelect, onCapture }: { topics: StudyTopic[]; onSelect: (topic: StudyTopic) => void; onCapture: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = topics.filter((topic) => `${topic.title} ${topic.breadcrumb}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeading title="Library" description="Every topic you have saved, whether it came from your plan or a quick capture." action={<button className="button-primary" onClick={onCapture}><Plus size={18} /> Add a topic</button>} /><label className="relative mb-5 block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} /><span className="sr-only">Search saved topics</span><input className="field !pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved topics…" /></label><p className="mb-3 text-sm text-[var(--muted)]">{filtered.length} {filtered.length === 1 ? "topic" : "topics"}</p><section className="content-surface divide-y divide-[var(--border)] overflow-hidden" aria-label="Saved topics">{filtered.map((topic) => <button key={topic.id} onClick={() => onSelect(topic)} className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-[color:var(--subtle)]/65 sm:px-5"><span className="min-w-0"><span className="block truncate font-semibold">{topic.title}</span><span className="text-xs text-[var(--muted)]">{topic.breadcrumb === "Personal topics" ? "Personal topic" : topic.breadcrumb} · Learned {humanDate(topic.learnedOn)}</span></span><span className="shrink-0 text-xs font-semibold text-[var(--muted)]">Review {humanDate(topic.reviewState.dueOn)}</span></button>)}</section></>;
}

function DemoPlan({ topics, onSelect }: { topics: StudyTopic[]; onSelect: (topic: StudyTopic) => void }) {
  const [query, setQuery] = useState("");
  const filtered = topics.filter((topic) => topic.breadcrumb !== "Personal topics" && `${topic.title} ${topic.breadcrumb}`.toLowerCase().includes(query.toLowerCase()));
  const primary = filtered.filter((topic) => topic.part === "frontend");
  const extension = filtered.filter((topic) => topic.part === "fullstack");
  return <><PageHeading title="Plan" description="Your learning roadmap, kept separate from the topics you have already saved." /><label className="relative mb-6 block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} /><span className="sr-only">Search learning plan</span><input className="field !pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the plan…" /></label><TopicGroup label="Primary plan" topics={primary} onSelect={onSelect} /><TopicGroup label="Extension plan" topics={extension} onSelect={onSelect} /></>;
}

function TopicGroup({ label, topics, onSelect }: { label: string; topics: StudyTopic[]; onSelect: (topic: StudyTopic) => void }) {
  return <section className="content-surface mb-6 overflow-hidden"><div className="border-b border-[var(--border)] p-5"><h2 className="font-bold">{label}</h2><p className="text-xs text-[var(--muted)]">{topics.length} active plan topics</p></div><div className="divide-y divide-[var(--border)]">{topics.map((topic) => <button key={topic.id} onClick={() => onSelect(topic)} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-[var(--subtle)] sm:px-5"><span><span className="block font-semibold">{topic.title}</span><span className="text-xs text-[var(--muted)]">{topic.breadcrumb}</span></span><span className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs capitalize text-[var(--muted)]">{topic.kind}</span></button>)}</div></section>;
}

function DemoActivity({ topics }: { topics: StudyTopic[] }) {
  const today = dateKey(new Date());
  const range = activityCalendarRange(today);
  const summary = useMemo(
    () => buildActivitySummary(createDemoActivityEvents(topics, today), range.start, range.end, today),
    [range.end, range.start, today, topics],
  );
  return <ActivityView summary={summary} today={today} />;
}

function DemoSettings({ onReset }: { onReset: () => void }) {
  return <><PageHeading eyebrow="Demo preferences" title="Simple defaults, explicit choices" description="Production settings sync across devices. These demo controls only affect this browser." /><section className="content-surface divide-y divide-[var(--border)]"><Setting title="Scheduler" copy="Fixed 1 day → 7 days → 30 days, then every 30 days"><span className="rounded-md border border-[var(--border)] px-2.5 py-1 text-sm font-semibold text-[var(--muted)]">Fixed rhythm</span></Setting><Setting title="Timezone" copy="Dates become due by owner calendar day, not by an arbitrary UTC midnight."><span className="text-sm font-semibold">Asia/Kolkata</span></Setting><Setting title="Reset sandbox" copy="Restore the ten curated demo topics and remove your local changes."><button className="button-secondary" data-liquid onClick={onReset}><RotateCcw size={17} /> Reset demo</button></Setting></section></>;
}

function Setting({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"><div><h2 className="font-bold">{title}</h2><p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{copy}</p></div>{children}</div>;
}

function CaptureModal({ onClose, onSave }: { onClose: () => void; onSave: (topic: StudyTopic) => void }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const now = new Date();
    const state = createReviewState("fixed", now);
    onSave({ id: `local-${crypto.randomUUID()}`, title: title.trim(), breadcrumb: "Personal topics", kind: "knowledge", part: "frontend", learnedOn: dateKey(now), activatedAt: now.toISOString(), scheduler: "fixed", keepWarmDays: 30, note: { markdown: note, revision: 1, updatedAt: now.toISOString() }, reviewState: state });
  }
  return <Modal label="Add a learned topic" onClose={onClose}><p className="eyebrow">Quick capture</p><h2 className="mt-1 text-2xl font-bold">What did you learn?</h2><p className="mt-2 text-sm text-[var(--muted)]">A rough explanation from memory is more useful than polished copied notes.</p><form className="mt-6 grid gap-5" onSubmit={submit}><label className="grid gap-1.5 font-semibold">Topic<input autoFocus required className="field font-normal" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bayes’ theorem" /></label><label className="grid gap-1.5 font-semibold">My notes <span className="text-xs font-normal text-[var(--muted)]">Markdown supported</span><textarea className="field min-h-44 resize-y font-mono text-sm font-normal" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain it in your own words…" /></label><div className="flex justify-end gap-2"><button type="button" className="button-ghost" onClick={onClose}>Cancel</button><button className="button-primary" disabled={!title.trim()}><CalendarDays size={18} /> Save and schedule</button></div></form></Modal>;
}

function ReviewModal({ topics, onClose, onUpdate }: { topics: StudyTopic[]; onClose: () => void; onUpdate: (topic: StudyTopic) => void }) {
  const due = useMemo(() => topics.filter((topic) => isDue(topic.reviewState.dueOn, dateKey(new Date()))), [topics]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [aiRevealed, setAiRevealed] = useState(false);
  const [scratch, setScratch] = useState("");
  const topic = due[index];
  if (!topic) return <Modal label="Review complete" onClose={onClose}><div className="py-10 text-center"><CheckCircle2 size={42} className="mx-auto text-[var(--accent)]" /><h2 className="mt-4 text-2xl font-bold">Review complete</h2><p className="mt-2 text-[var(--muted)]">That is enough for today.</p><button className="button-primary mt-6" onClick={onClose}>Back to Today</button></div></Modal>;
  function rate(rating: ReviewRating) {
    const reviewState = scheduleReview(topic.reviewState, rating, new Date(), topic.keepWarmDays);
    onUpdate({ ...topic, reviewState });
    setIndex((value) => value + 1); setRevealed(false); setAiRevealed(false); setScratch("");
  }
  return <Modal label={`Review ${topic.title}`} onClose={onClose}><div className="flex items-center justify-between gap-4"><p className="eyebrow">Topic {index + 1} of {due.length}</p><span className="text-xs text-[var(--muted)]">Recall before revealing</span></div><h2 className="mt-2 text-balance text-3xl font-bold">{topic.title}</h2><p className="mt-1 text-sm text-[var(--muted)]">{topic.breadcrumb}</p><label className="mt-6 grid gap-2 font-semibold">What can you explain from memory?<textarea autoFocus className="field min-h-32 resize-y font-normal" value={scratch} onChange={(e) => setScratch(e.target.value)} placeholder="Private scratchpad for this review…" /></label>{!revealed ? <button className="button-primary mt-5 w-full" data-liquid onClick={() => setRevealed(true)}>Reveal my notes</button> : <><div className="reading-plane mt-5 p-5"><p className="eyebrow mb-3">My notes</p><Markdown>{topic.note.markdown || "_No notes yet._"}</Markdown></div>{topic.aiNote && !topic.aiNote.hidden && (!aiRevealed ? <button className="button-secondary mt-3 w-full" data-liquid onClick={() => setAiRevealed(true)}><Sparkles size={17} /> Reveal separate AI notes</button> : <div className="ai-plane mt-3 p-5"><p className="eyebrow mb-3">AI notes · {topic.aiNote.model}</p><p>{topic.aiNote.document.summary}</p><ul className="mt-3 list-disc pl-5">{topic.aiNote.document.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul></div>)}<p className="mb-2 mt-6 text-center text-sm font-semibold">How well did you recall it?</p><div className="grid grid-cols-3 gap-2">{(["again", "hard", "good"] as const).map((rating) => <button key={rating} data-liquid className={rating === "good" ? "button-primary !px-2 capitalize" : "button-secondary !px-2 capitalize"} onClick={() => rate(rating)}>{rating}</button>)}</div></> }</Modal>;
}

function TopicModal({ topic, onClose, onUpdate }: { topic: StudyTopic; onClose: () => void; onUpdate: (topic: StudyTopic) => void }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(topic.note.markdown);
  const stale = topic.aiNote && topic.aiNote.sourceNoteRevision < topic.note.revision;
  function save() {
    onUpdate({ ...topic, note: { markdown: note, revision: topic.note.revision + 1, updatedAt: new Date().toISOString() } }); setEditing(false);
  }
  const sourceLabel = topic.breadcrumb === "Personal topics" ? "Personal topic" : topic.part === "frontend" ? "Primary plan" : "Extension plan";
  return <Modal label={topic.title} onClose={onClose}><p className="eyebrow">{sourceLabel}</p><h2 className="mt-2 text-balance text-3xl font-bold">{topic.title}</h2><p className="mt-1 text-sm text-[var(--muted)]">{topic.breadcrumb}</p><div className="mt-5 flex flex-wrap gap-2 text-xs"><span className="rounded-md border border-[var(--border)] bg-[color:var(--surface)]/60 px-3 py-1">Next review {humanDate(topic.reviewState.dueOn)}</span><span className="rounded-md border border-[var(--border)] bg-[color:var(--surface)]/60 px-3 py-1 capitalize">{topic.scheduler}</span></div><section className="mt-7"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">My notes</h3>{editing ? <div className="flex gap-2"><button className="button-ghost !min-h-9" onClick={() => setEditing(false)}>Cancel</button><button className="button-primary !min-h-9" data-liquid onClick={save}>Save</button></div> : <button className="button-secondary !min-h-9" data-liquid onClick={() => setEditing(true)}>Edit</button>}</div>{editing ? <textarea className="field min-h-64 resize-y font-mono text-sm" value={note} onChange={(e) => setNote(e.target.value)} /> : <div className="reading-plane p-5"><Markdown>{topic.note.markdown || "_No personal notes yet._"}</Markdown></div>}</section>{topic.aiNote && !topic.aiNote.hidden && <section className="mt-7"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="inline-flex items-center gap-2 text-lg font-bold"><Sparkles size={18} className="text-[var(--plum)]" /> AI notes</h3><span className="text-xs text-[var(--muted)]">{topic.aiNote.provider} · {topic.aiNote.model}</span></div>{stale && <p className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted)]">Your notes changed after this explanation was generated. It may still be useful.</p>}<div className="ai-plane p-5"><p>{topic.aiNote.document.summary}</p><h4 className="mt-4 font-bold">Key points</h4><ul className="mt-2 list-disc pl-5">{topic.aiNote.document.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul><h4 className="mt-4 font-bold">Pitfalls</h4><ul className="mt-2 list-disc pl-5">{topic.aiNote.document.pitfalls.map((point) => <li key={point}>{point}</li>)}</ul></div></section>}</Modal>;
}
