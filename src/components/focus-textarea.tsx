"use client";

import { Maximize2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function FocusTextarea({
  label,
  dialogTitle,
  value,
  onChange,
  placeholder,
  maxLength,
  autoFocus,
  readOnly,
  className = "min-h-40",
}: {
  label: React.ReactNode;
  dialogTitle: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  readOnly?: boolean;
  className?: string;
}) {
  const id = useId();
  const dialogTitleId = `${id}-dialog-title`;
  const [expanded, setExpanded] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const expandedEditor = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!expanded || !dialog.current) return;
    const element = dialog.current;
    const openerElement = opener.current;
    const previousOverflow = document.documentElement.style.overflow;

    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    document.documentElement.style.overflow = "hidden";
    expandedEditor.current?.focus();
    const cursor = expandedEditor.current?.value.length ?? 0;
    expandedEditor.current?.setSelectionRange(cursor, cursor);

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      if (typeof element.close === "function" && element.open) element.close();
      else element.removeAttribute("open");
      openerElement?.focus();
    };
  }, [expanded]);

  const editor = (
    <textarea
      id={id}
      autoFocus={autoFocus}
      className={`field resize-y font-normal ${className}`}
      maxLength={maxLength}
      readOnly={readOnly}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );

  return (
    <div className="grid gap-2">
      <div className="flex items-start justify-between gap-3">
        <label className="font-semibold" htmlFor={id}>{label}</label>
        {!readOnly && (
          <button
            ref={opener}
            type="button"
            className="button-ghost !min-h-8 shrink-0 !px-2 text-xs"
            onClick={() => setExpanded(true)}
            aria-haspopup="dialog"
            aria-label={`Expand ${dialogTitle}`}
          >
            <Maximize2 size={14} /> Expand
          </button>
        )}
      </div>
      {editor}
      {expanded && createPortal(
        <dialog
          ref={dialog}
          className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-[var(--background)] p-0 text-[var(--foreground)] backdrop:bg-black/55"
          aria-labelledby={dialogTitleId}
          onCancel={() => setExpanded(false)}
        >
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 py-4 sm:px-8 sm:py-6">
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div className="min-w-0">
                <h2 id={dialogTitleId} className="text-lg font-bold sm:text-xl">{dialogTitle}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">This is the same draft. Closing this view will not discard it.</p>
              </div>
              <button type="button" className="button-secondary shrink-0" onClick={() => setExpanded(false)}>
                <X size={17} /> Close
              </button>
            </header>
            <label className="sr-only" htmlFor={`${id}-expanded`}>{dialogTitle}</label>
            <textarea
              ref={expandedEditor}
              id={`${id}-expanded`}
              className="field mt-5 min-h-0 flex-1 resize-none p-4 text-base leading-7 sm:p-5"
              maxLength={maxLength}
              readOnly={readOnly}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
            />
            <footer className="mt-3 flex items-center justify-between gap-4 text-xs text-[var(--muted)]">
              <span className="hidden sm:inline">Press Esc to close</span>
              <span className="sm:hidden">Use Close when finished</span>
              {maxLength && <span>{value.length.toLocaleString()} / {maxLength.toLocaleString()}</span>}
            </footer>
          </div>
        </dialog>,
        document.body,
      )}
    </div>
  );
}
