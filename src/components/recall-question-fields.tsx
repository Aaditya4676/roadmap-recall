"use client";

import { ClipboardPaste, Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import type { RecallQuestion } from "@/lib/domain/types";
import {
  MAX_RECALL_ANSWER_CHARS,
  MAX_RECALL_QUESTION_CHARS,
  MAX_RECALL_QUESTIONS,
  MAX_RECALL_TOTAL_CHARS,
  parseQuestionAnswerPairs,
  recallQuestionCharacterCount,
  readyRecallQuestions,
} from "@/lib/recall";

function questionId() {
  return crypto.randomUUID();
}

export function RecallQuestionFields({
  questions,
  onChange,
}: {
  questions: RecallQuestion[];
  onChange: (questions: RecallQuestion[]) => void;
}) {
  const fieldId = useId();
  const [pasting, setPasting] = useState(false);
  const [bulk, setBulk] = useState("");
  const [message, setMessage] = useState("");
  const readyCount = readyRecallQuestions(questions).length;

  function update(id: string, patch: Partial<RecallQuestion>) {
    const next = questions.map((item) => item.id === id ? { ...item, ...patch } : item);
    if (recallQuestionCharacterCount(next) > MAX_RECALL_TOTAL_CHARS) {
      setMessage("Recall questions and ideal answers can use up to 100,000 characters in one note.");
      return;
    }
    setMessage("");
    onChange(next);
  }

  function add() {
    if (questions.length >= MAX_RECALL_QUESTIONS) return;
    onChange([...questions, { id: questionId(), question: "", idealAnswer: "" }]);
  }

  function importPairs() {
    let parsed: ReturnType<typeof parseQuestionAnswerPairs>;
    try {
      parsed = parseQuestionAnswerPairs(bulk);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The pasted Q&A could not be imported.");
      return;
    }
    if (!parsed.length) {
      setMessage("No complete Q: / A: pairs were found.");
      return;
    }
    const room = MAX_RECALL_QUESTIONS - questions.length;
    if (parsed.length > room) {
      setMessage(`There is room for ${room} more ${room === 1 ? "question" : "questions"}. Nothing was imported, so your paste is still here.`);
      return;
    }
    const additions = parsed.map((item) => ({ id: questionId(), ...item }));
    if (recallQuestionCharacterCount([...questions, ...additions]) > MAX_RECALL_TOTAL_CHARS) {
      setMessage("These pairs would exceed the 100,000-character note limit. Split the material into smaller topics.");
      return;
    }
    onChange([...questions, ...additions]);
    setBulk("");
    setPasting(false);
    setMessage(`Imported ${additions.length} ${additions.length === 1 ? "pair" : "pairs"}.`);
  }

  return (
    <section aria-labelledby={`${fieldId}-heading`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`${fieldId}-heading`} className="font-bold">Recall questions</h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            During review, you will answer these before seeing the ideal answers. Incomplete pairs stay in the editor but are skipped.
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{readyCount} ready · {questions.length} total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="button-secondary !min-h-9" onClick={() => { setPasting((value) => !value); setMessage(""); }}>
            {pasting ? <X size={15} /> : <ClipboardPaste size={15} />} {pasting ? "Close paste" : "Paste Q&A"}
          </button>
          <button type="button" className="button-secondary !min-h-9" disabled={questions.length >= MAX_RECALL_QUESTIONS} onClick={add}>
            <Plus size={15} /> Add question
          </button>
        </div>
      </div>

      {pasting && (
        <div className="mt-4 border-y border-[var(--border)] bg-[color:var(--surface-muted)]/55 p-4">
          <label className="grid gap-1.5 text-sm font-semibold" htmlFor={`${fieldId}-paste`}>
            Paste Q&A pairs
            <textarea
              id={`${fieldId}-paste`}
              className="field min-h-44 resize-y font-mono text-sm font-normal"
              value={bulk}
              onChange={(event) => setBulk(event.target.value)}
              placeholder={"Q: What does semantic HTML mean?\nA: Use elements according to their meaning, not their appearance.\n\nQ: What does aria-invalid do?\nA: It exposes invalid state but does not perform validation."}
            />
          </label>
          <p className="mt-2 text-xs text-[var(--muted)]">Start each pair with Q: and A:. Answers may span multiple lines.</p>
          <div className="mt-3 flex justify-end">
            <button type="button" className="button-primary !min-h-9" disabled={!bulk.trim()} onClick={importPairs}>Import pairs</button>
          </div>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-[var(--muted)]" role={message.startsWith("Imported ") ? "status" : "alert"}>{message}</p>}

      {questions.length ? (
        <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {questions.map((item, index) => (
            <fieldset className="py-5 first:pt-4 last:pb-4" key={item.id}>
              <legend className="sr-only">Recall question {index + 1}</legend>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-bold">Question {index + 1}</span>
                <button
                  type="button"
                  className="button-ghost !min-h-8 !px-2 text-[var(--danger)]"
                  onClick={() => onChange(questions.filter((question) => question.id !== item.id))}
                  aria-label={`Remove question ${index + 1}`}
                >
                  <Trash2 size={15} /> Remove
                </button>
              </div>
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-sm font-semibold" htmlFor={`${fieldId}-${item.id}-question`}>
                  Prompt
                  <textarea
                    id={`${fieldId}-${item.id}-question`}
                    className="field min-h-20 resize-y font-normal"
                    maxLength={MAX_RECALL_QUESTION_CHARS}
                    value={item.question}
                    onChange={(event) => update(item.id, { question: event.target.value })}
                    placeholder="Ask one focused question."
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold" htmlFor={`${fieldId}-${item.id}-answer`}>
                  Ideal answer
                  <textarea
                    id={`${fieldId}-${item.id}-answer`}
                    className="field min-h-28 resize-y font-normal"
                    maxLength={MAX_RECALL_ANSWER_CHARS}
                    value={item.idealAnswer}
                    onChange={(event) => update(item.id, { idealAnswer: event.target.value })}
                    placeholder="Paste the answer you want to compare against later."
                  />
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      ) : (
        <div className="mt-4 border-y border-[var(--border)] py-5 text-sm text-[var(--muted)]">
          No questions yet. Reviews will use the open-ended memory prompt until you add a complete pair.
        </div>
      )}
    </section>
  );
}
