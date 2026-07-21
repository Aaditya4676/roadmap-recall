import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteEditor } from "@/components/note-editor";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });

describe("NoteEditor autosave", () => {
  it("serializes overlapping edits and advances the expected revision", async () => {
    vi.useFakeTimers();
    let finishFirst!: (value: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
    const first = new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((resolve) => { finishFirst = resolve; });
    const calls: Array<{ markdown: string; expectedRevision: number }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      if (calls.length === 1) return first;
      return { ok: true, status: 200, json: async () => ({ revision: 3 }) };
    }));

    render(<NoteEditor topicId="topic" initialMarkdown="start" initialRevision={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "first" } });
    fireEvent.click(screen.getByRole("button", { name: "Save now" }));
    fireEvent.change(editor, { target: { value: "second" } });
    await act(async () => { vi.advanceTimersByTime(900); });
    await act(async () => { finishFirst({ ok: true, status: 200, json: async () => ({ revision: 2 }) }); await first; });
    await act(async () => { await Promise.resolve(); });

    expect(calls).toEqual([
      { markdown: "first", expectedRevision: 1 },
      { markdown: "second", expectedRevision: 2 },
    ]);
    expect(localStorage.getItem("roadmap-recall-draft-topic")).toBeNull();
  });
});
