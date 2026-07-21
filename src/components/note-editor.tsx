"use client";

import { Check, Cloud, CloudOff, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";

export function NoteEditor({ topicId, initialMarkdown, initialRevision }: { topicId: string; initialMarkdown: string; initialRevision: number }) {
  const [editing, setEditing] = useState(false);
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [savedMarkdown, setSavedMarkdown] = useState(initialMarkdown);
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "offline" | "conflict">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(initialRevision);
  const saving = useRef(false);
  const pending = useRef<string | null>(null);
  const draftKey = `roadmap-recall-draft-${topicId}`;
  useEffect(() => {
    queueMicrotask(() => {
      const local = localStorage.getItem(draftKey);
      if (local && local !== initialMarkdown) { setMarkdown(local); setStatus("dirty"); }
    });
  }, [draftKey, initialMarkdown]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function save(value = markdown) {
    pending.current = value;
    if (saving.current) return;
    saving.current = true;
    try {
      let lastSaved = value;
      while (pending.current !== null) {
        const next = pending.current;
        pending.current = null;
        setStatus("saving");
        const response = await fetch(`/api/app/topics/${topicId}/note`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ markdown: next, expectedRevision: revision.current }) });
        const data = await response.json();
        if (response.status === 409) { pending.current = null; setStatus("conflict"); return; }
        if (!response.ok) throw new Error(data.error?.message);
        revision.current = data.revision;
        lastSaved = next;
        setSavedMarkdown(next);
      }
      if (localStorage.getItem(draftKey) === lastSaved) localStorage.removeItem(draftKey);
      setStatus("saved");
    } catch { setStatus("offline"); }
    finally { saving.current = false; }
  }
  function change(value: string) {
    setMarkdown(value); setStatus("dirty"); localStorage.setItem(draftKey, value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(value), 900);
  }
  return <section><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">My notes</h2><p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">{status === "saved" ? <><Check size={13} /> Saved</> : status === "saving" ? <><Cloud size={13} /> Saving…</> : status === "offline" ? <><CloudOff size={13} /> Local draft kept; retry when online</> : status === "conflict" ? <><CloudOff size={13} /> Newer server revision found—copy your draft, then reload</> : "Unsaved changes"}</p></div><button className="button-secondary !min-h-9" onClick={() => setEditing((value) => !value)}><Pencil size={15} /> {editing ? "Preview" : "Edit"}</button></div>{editing ? <><textarea className="field min-h-80 resize-y font-mono text-sm" value={markdown} onChange={(e) => change(e.target.value)} /><div className="mt-3 flex justify-end"><button className="button-primary !min-h-9" disabled={status === "saved" || status === "saving"} onClick={() => save()}>Save now</button></div></> : <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-5 sm:p-6"><Markdown>{savedMarkdown || "_No personal notes yet. Choose Edit to add your explanation._"}</Markdown></div>}</section>;
}
