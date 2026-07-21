"use client";

import { CalendarDays, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dateKey } from "@/lib/date";

export function CaptureTopic({ roadmapItemId, label = "Add what I learned", initialTitle = "" }: { roadmapItemId?: string; label?: string; initialTitle?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [note, setNote] = useState("");
  const [learnedOn, setLearnedOn] = useState(dateKey(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch("/api/app/topics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roadmapItemId, title: roadmapItemId ? undefined : title, note, learnedOn }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error?.message ?? "Could not save the topic."); setSaving(false); return; }
    setOpen(false); router.push(`/app/topics/${data.id}`); router.refresh();
  }
  return (
    <>
      <button className={roadmapItemId ? "button-secondary !min-h-9" : "button-secondary"} onClick={() => setOpen(true)}>
        <Plus size={17} /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 sm:place-items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Capture learned topic" className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:max-w-xl sm:rounded-[10px]">
            <div className="flex justify-end">
              <button className="button-ghost !size-10 !p-0" onClick={() => setOpen(false)} aria-label="Close"><X size={19} /></button>
            </div>
            <p className="context-label">Quick capture</p>
            <h2 className="mt-1 text-2xl font-bold">{roadmapItemId ? initialTitle : "What did you learn?"}</h2>
            <form className="mt-6 grid gap-5" onSubmit={submit}>
              {!roadmapItemId && <label className="grid gap-1.5 font-semibold">Topic<input autoFocus required className="field font-normal" value={title} onChange={(event) => setTitle(event.target.value)} /></label>}
              <label className="grid gap-1.5 font-semibold">My notes <span className="text-xs font-normal text-[var(--muted)]">Markdown · your words</span><textarea autoFocus={Boolean(roadmapItemId)} className="field min-h-48 resize-y font-mono text-sm font-normal" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain it from memory…" /></label>
              <label className="grid gap-1.5 font-semibold">Learned on<input className="field font-normal" type="date" value={learnedOn} onChange={(event) => setLearnedOn(event.target.value)} /></label>
              {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
              <button className="button-primary" disabled={saving || (!roadmapItemId && !title.trim())}><CalendarDays size={18} /> {saving ? "Saving…" : "Save and schedule"}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
