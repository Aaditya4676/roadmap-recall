import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TopicLibrary } from "@/components/topic-library";
import type { LibraryTopicSummary } from "@/lib/domain/topic-summary";

const topics: LibraryTopicSummary[] = [
  {
    id: "personal-1",
    title: "AbortController ownership",
    breadcrumb: "Personal topics",
    kind: "knowledge",
    learnedOn: "2026-07-23",
    activatedAt: "2026-07-23T08:00:00.000Z",
    scheduler: "fixed",
    reviewCount: 0,
    source: "personal",
    dueOn: "2026-07-24",
    hasVisibleAiNote: false,
  },
  {
    id: "plan-1",
    title: "Event loop",
    breadcrumb: "5. JavaScript",
    kind: "knowledge",
    learnedOn: "2026-07-20",
    activatedAt: "2026-07-20T08:00:00.000Z",
    scheduler: "fsrs",
    reviewCount: 2,
    source: "plan",
    dueOn: "2026-07-23",
    hasVisibleAiNote: true,
  },
];

afterEach(cleanup);

describe("TopicLibrary", () => {
  it("keeps personal captures visible and links them to their note page", async () => {
    const user = userEvent.setup();
    render(<TopicLibrary topics={topics} today="2026-07-23" />);

    expect(screen.getByRole("link", { name: /AbortController ownership/i })).toHaveAttribute("href", "/app/topics/personal-1");
    expect(screen.getByRole("link", { name: /Event loop/i })).toBeVisible();

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by source" }), "personal");
    expect(screen.getByRole("link", { name: /AbortController ownership/i })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Event loop/i })).not.toBeInTheDocument();
  });

  it("searches saved topics independently of their source", async () => {
    const user = userEvent.setup();
    render(<TopicLibrary topics={topics} today="2026-07-23" />);

    await user.type(screen.getByRole("textbox", { name: "Search saved topics" }), "event loop");
    expect(screen.getByRole("link", { name: /Event loop/i })).toBeVisible();
    expect(screen.queryByRole("link", { name: /AbortController ownership/i })).not.toBeInTheDocument();
  });
});
