"use client";

import { EyeOff, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AiNoteRecord } from "@/lib/domain/types";

export function AiNotePanel({ topicId, note, personalRevision }: { topicId: string; note?: AiNoteRecord; personalRevision: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [includePersonal, setIncludePersonal] = useState(false);
  const stale = note && note.sourceNoteRevision < personalRevision;

  async function call(method: "generate" | "hide" | "discard") {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/app/topics/${topicId}/ai-notes/${method}`, {
      method: method === "generate" ? "POST" : "DELETE",
      headers: { "content-type": "application/json" },
      body: method === "generate"
        ? JSON.stringify({ provider: "gemini", includePersonalNotes: includePersonal })
        : method === "discard" ? JSON.stringify({ expectedRevision: note?.revision ?? 0 }) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error?.message ?? "The AI note action failed.");
    else router.refresh();
    setBusy(false);
  }

  if (!note || note.hidden) {
    return (
      <section className="mt-8">
        <div className="liquid-panel rounded-[12px] border-dashed p-6 text-center" data-liquid>
          <Sparkles size={23} className="mx-auto text-[var(--plum)]" />
          <h2 className="mt-4 text-xl font-bold">No AI notes yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--muted)]">Optional AI material stays separate. Review the exact context choice before sending anything to a provider.</p>
          <label className="mx-auto mt-4 flex max-w-md items-start justify-center gap-2 text-left text-sm text-[var(--muted)]">
            <input className="mt-1" type="checkbox" checked={includePersonal} onChange={(event) => setIncludePersonal(event.target.checked)} />
            Include my personal note in this request
          </label>
          <p className="mx-auto mt-3 max-w-md text-xs text-[var(--muted)]">If you use an unpaid Gemini service, Google may use submitted content to improve its products. Do not send confidential notes.</p>
          <button className="button-secondary mt-4" data-liquid disabled={busy} onClick={() => call("generate")}>
            <Sparkles size={17} /> {busy ? "Generating…" : "Generate with Gemini"}
          </button>
          {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
        </div>
      </section>
    );
  }

  const doc = note.document;
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-xl font-bold"><Sparkles size={19} className="text-[var(--plum)]" /> AI notes</h2>
          <p className="text-xs text-[var(--muted)]">{note.provider} · {note.model} · revision {note.revision}</p>
        </div>
        <div className="flex gap-1">
          <button className="button-ghost !min-h-9 !px-2" disabled={busy} onClick={() => call("generate")} title="Regenerate"><RefreshCw size={16} /></button>
          <button className="button-ghost !min-h-9 !px-2" disabled={busy} onClick={() => call("hide")} title="Hide"><EyeOff size={16} /></button>
          <button className="button-danger !min-h-9 !px-2" disabled={busy} onClick={() => call("discard")} title="Discard current AI note"><Trash2 size={16} /></button>
        </div>
      </div>
      {stale && <p className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted)]">Your personal note changed after this was generated. The explanation may still be useful, or you can regenerate it.</p>}
      <article className="ai-plane p-5 sm:p-6">
        <p className="leading-relaxed">{doc.summary}</p>
        <AiList title="Key points" items={doc.keyPoints} />
        <AiList title="Pitfalls" items={doc.pitfalls} />
        {doc.mentalModel && <div className="mt-5"><h3 className="font-bold">Mental model</h3><p className="mt-1">{doc.mentalModel}</p></div>}
        <AiList title="Practice ideas" items={doc.practiceIdeas} />
        <AiList title="Connections" items={doc.connections} />
        {doc.recallQuestions.length > 0 && (
          <div className="mt-5">
            <h3 className="font-bold">Recall questions</h3>
            <div className="mt-2 grid gap-2">
              {doc.recallQuestions.map((item) => (
                <details key={item.question} className="reading-plane p-3">
                  <summary className="cursor-pointer font-medium">{item.question}</summary>
                  {item.answer && <p className="mt-2 text-sm text-[var(--muted)]">{item.answer}</p>}
                </details>
              ))}
            </div>
          </div>
        )}
      </article>
      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
    </section>
  );
}

function AiList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <div className="mt-5"><h3 className="font-bold">{title}</h3><ul className="mt-2 list-disc space-y-1 pl-5">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}
