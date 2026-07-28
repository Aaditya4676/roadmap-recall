"use client";

import { Check, Cloud, CloudOff, Pencil } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { RecallQuestionFields } from "@/components/recall-question-fields";
import { RecallQuestionReference } from "@/components/recall-question-reference";
import type { RecallAnswerGrade, RecallAnswerSnapshot, RecallQuestion } from "@/lib/domain/types";
import { readRecallQuestions } from "@/lib/recall";

type NoteStatus = "saved" | "dirty" | "saving" | "offline" | "conflict";
type NoteDraft = { markdown: string; recallQuestions: RecallQuestion[] };

function draftJson(draft: NoteDraft) {
  return JSON.stringify({ version: 2, ...draft });
}

function readLocalDraft(value: string | null, fallback: NoteDraft): NoteDraft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed?.version === 2 && typeof parsed.markdown === "string") {
      return { markdown: parsed.markdown, recallQuestions: readRecallQuestions(parsed.recallQuestions) };
    }
  } catch {
    // Fall through: v1 stored the Markdown string directly.
  }
  return value === fallback.markdown ? null : { ...fallback, markdown: value };
}

export function NoteEditor({
  topicId,
  initialMarkdown,
  initialQuestions,
  initialRevision,
  latestRecallAnswers,
  latestRecallGrades = [],
}: {
  topicId: string;
  initialMarkdown: string;
  initialQuestions: RecallQuestion[];
  initialRevision: number;
  latestRecallAnswers: RecallAnswerSnapshot[];
  latestRecallGrades?: RecallAnswerGrade[];
}) {
  const initialDraft = useMemo<NoteDraft>(
    () => ({ markdown: initialMarkdown, recallQuestions: initialQuestions }),
    [initialMarkdown, initialQuestions],
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NoteDraft>(initialDraft);
  const [status, setStatus] = useState<NoteStatus>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(initialRevision);
  const saving = useRef(false);
  const pending = useRef<NoteDraft | null>(null);
  const draftKey = `roadmap-recall-draft-${topicId}`;

  useEffect(() => {
    queueMicrotask(() => {
      const local = readLocalDraft(localStorage.getItem(draftKey), initialDraft);
      if (local && draftJson(local) !== draftJson(initialDraft)) {
        setDraft(local);
        setStatus("dirty");
      }
    });
  }, [draftKey, initialDraft]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function save(value = draft) {
    pending.current = value;
    if (saving.current) return;
    saving.current = true;
    try {
      let lastSaved = value;
      while (pending.current !== null) {
        const next = pending.current;
        pending.current = null;
        setStatus("saving");
        const response = await fetch(`/api/app/topics/${topicId}/note`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            markdown: next.markdown,
            recallQuestions: next.recallQuestions,
            expectedRevision: revision.current,
          }),
        });
        const data = await response.json();
        if (response.status === 409) {
          pending.current = null;
          setStatus("conflict");
          return;
        }
        if (!response.ok) throw new Error(data.error?.message);
        revision.current = data.revision;
        lastSaved = next;
      }
      if (localStorage.getItem(draftKey) === draftJson(lastSaved)) localStorage.removeItem(draftKey);
      setStatus("saved");
    } catch {
      setStatus("offline");
    } finally {
      saving.current = false;
    }
  }

  function change(next: NoteDraft) {
    setDraft(next);
    setStatus("dirty");
    localStorage.setItem(draftKey, draftJson(next));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), 900);
  }

  const statusMessage = status === "saved"
    ? <><Check size={13} /> Saved</>
    : status === "saving"
      ? <><Cloud size={13} /> Saving…</>
      : status === "offline"
        ? <><CloudOff size={13} /> Local draft kept; retry when online</>
        : status === "conflict"
          ? <><CloudOff size={13} /> Newer server revision found—copy your draft, then reload</>
          : "Unsaved changes";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">My notes</h2>
          <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">{statusMessage}</p>
        </div>
        <button className="button-secondary !min-h-9" data-liquid onClick={() => setEditing((value) => !value)}>
          <Pencil size={15} /> {editing ? "Preview" : "Edit"}
        </button>
      </div>

      {editing ? (
        <div className="grid gap-7">
          <label className="grid gap-1.5 text-sm font-semibold">
            Reference notes <span className="text-xs font-normal text-[var(--muted)]">Markdown supported</span>
            <textarea
              className="field min-h-80 resize-y font-mono text-sm font-normal"
              value={draft.markdown}
              onChange={(event) => change({ ...draft, markdown: event.target.value })}
              placeholder="Explain the topic in your own words…"
            />
          </label>
          <RecallQuestionFields
            questions={draft.recallQuestions}
            onChange={(recallQuestions) => change({ ...draft, recallQuestions })}
          />
          <div className="flex justify-end">
            <button className="button-primary !min-h-9" data-liquid disabled={status === "saving"} onClick={() => save()}>
              Save now
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="reading-plane p-5 sm:p-6">
            <Markdown>{draft.markdown || "_No personal notes yet. Choose Edit to add your explanation._"}</Markdown>
          </div>
          <RecallQuestionReference
            questions={draft.recallQuestions}
            latestAnswers={latestRecallAnswers}
            latestGrades={latestRecallGrades}
          />
        </>
      )}
    </section>
  );
}
