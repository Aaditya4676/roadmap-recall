import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewSession } from "@/components/review-session";
import type { StudyTopic } from "@/lib/domain/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const question = {
  id: "8acefc73-997a-4db5-a24a-afadf8799623",
  question: "What does aria-invalid do?",
  idealAnswer: "It exposes invalid state but does not validate the input.",
};

function topic(): StudyTopic {
  return {
    id: "3ef54e20-7d09-4e99-8ea4-1f453227bbaa",
    title: "Accessible validation",
    breadcrumb: "Accessibility",
    kind: "knowledge",
    part: "frontend",
    learnedOn: "2026-07-24",
    activatedAt: "2026-07-24T05:00:00.000Z",
    scheduler: "fixed",
    keepWarmDays: 30,
    note: {
      markdown: "Validation should be understandable without color.",
      recallQuestions: [question],
      revision: 2,
      updatedAt: "2026-07-24T05:00:00.000Z",
    },
    reviewState: {
      scheduler: "fixed",
      dueAt: "2026-07-25T06:30:00.000Z",
      dueOn: "2026-07-25",
      lastReviewedAt: "2026-07-24T06:30:00.000Z",
      reviewCount: 1,
      fixedStage: 0,
      fsrsCard: null,
      latestRecallAnswers: [{ ...question, answer: "It tells a screen reader the field is invalid." }],
    },
  };
}

describe("ReviewSession structured recall", () => {
  it("autosaves and restores an unfinished structured response", async () => {
    const user = userEvent.setup();
    const currentTopic = topic();
    const { unmount } = render(<ReviewSession initialTopics={[currentTopic]} />);

    await user.type(
      screen.getByRole("textbox", { name: /What does aria-invalid do/i }),
      "It communicates invalid state.",
    );
    expect(localStorage.getItem(`roadmap-recall-review-draft-${currentTopic.id}`))
      .toContain("It communicates invalid state.");

    unmount();
    render(<ReviewSession initialTopics={[currentTopic]} />);

    expect(await screen.findByDisplayValue("It communicates invalid state.")).toBeVisible();
    expect(screen.getByText("Recovered your autosaved response from this device.")).toBeVisible();
  });

  it("keeps references hidden, then submits a versioned answer snapshot", async () => {
    const user = userEvent.setup();
    const nextState = { ...topic().reviewState, reviewCount: 2 };
    const requests: RequestInit[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(init ?? {});
      return {
      ok: true,
      status: 200,
      json: async () => ({ reviewState: nextState }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewSession initialTopics={[topic()]} />);
    expect(screen.queryByText(question.idealAnswer)).not.toBeInTheDocument();
    expect(screen.queryByText(/It tells a screen reader/)).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /What does aria-invalid do/i }), "It only communicates invalid state.");
    await user.click(screen.getByRole("button", { name: "Check my answers" }));

    expect(screen.getByText(question.idealAnswer)).toBeVisible();
    expect(screen.getByText(/It tells a screen reader/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "good" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(requests[0].body))).toMatchObject({
      rating: "good",
      expectedReviewCount: 1,
      scratchpad: "",
      appendScratchpad: false,
      recallAnswers: [{
        questionId: question.id,
        answer: "It only communicates invalid state.",
      }],
    });
    expect(await screen.findByRole("heading", { name: "Review complete" })).toBeVisible();
    expect(localStorage.getItem(`roadmap-recall-review-draft-${topic().id}`)).toBeNull();
  });

  it("guards duplicate ratings while a save is in flight", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewSession initialTopics={[topic()]} />);
    await user.click(screen.getByRole("button", { name: "Check my answers" }));
    const rating = screen.getByRole("button", { name: "good" });
    fireEvent.click(rating);
    fireEvent.click(rating);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(rating).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Saving your review");
    expect(screen.getByRole("link", { name: /End session/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("uses a validated AI recommendation while keeping manual ratings available", async () => {
    const user = userEvent.setup();
    const currentTopic = topic();
    const requests: Array<{ input: string; body: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      if (String(input).endsWith("/review/judge")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            assessment: {
              retainedPercent: 75,
              meanScore: 7.5,
              scoreScale: 10,
              continuousGrade: 3,
              recommendedRating: "good",
              provider: "gemini",
              model: "gemini-3.6-flash",
              summary: "The core behavior was retained.",
              results: [{ questionId: question.id, score: 7.5, feedback: "The answer kept the essential distinction." }],
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ reviewState: { ...currentTopic.reviewState, reviewCount: 2 } }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewSession initialTopics={[currentTopic]} configuredProviders={["gemini"]} />);
    await user.type(screen.getByRole("textbox", { name: /What does aria-invalid do/i }), "It communicates invalid state.");
    await user.click(screen.getByRole("button", { name: "Check my answers" }));

    expect(screen.getByRole("button", { name: "good" })).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: /Send these questions, ideal answers/i }));
    await user.click(screen.getByRole("button", { name: "Grade with Gemini" }));
    expect(await screen.findByText("75% answer quality / FSRS grade 3.00")).toBeVisible();
    expect(requests[0]).toMatchObject({
      input: `/api/app/topics/${currentTopic.id}/review/judge`,
      body: {
        provider: "gemini",
        consent: true,
        expectedNoteRevision: 2,
        answers: [{ questionId: question.id, answer: "It communicates invalid state." }],
      },
    });

    await user.click(screen.getByRole("button", { name: "Schedule from 75% AI score" }));
    expect(requests[1].body).toMatchObject({
      rating: "good",
      aiAssessment: {
        retainedPercent: 75,
        recommendedRating: "good",
        provider: "gemini",
        model: "gemini-3.6-flash",
      },
    });
  });

  it("surfaces validation details and offers recovery for stale sessions", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: "invalid_body", issues: [{ message: "Recall answer is too large." }] } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: "revision_conflict", message: "Review state changed. Reload this session." } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewSession initialTopics={[topic()]} />);
    expect(screen.getByRole("textbox", { name: /What does aria-invalid do/i }))
      .toHaveAttribute("maxlength", "12000");
    await user.click(screen.getByRole("button", { name: "Check my answers" }));

    await user.click(screen.getByRole("button", { name: "good" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Recall answer is too large.");

    await user.click(screen.getByRole("button", { name: "good" }));
    expect(await screen.findByRole("button", { name: "Reload this session" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Review state changed.");
  });

  it("returns a manually opened review to its topic page", async () => {
    const user = userEvent.setup();
    const currentTopic = topic();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        reviewState: { ...currentTopic.reviewState, reviewCount: 2 },
      }),
    })));

    render(<ReviewSession initialTopics={[currentTopic]} mode="single" />);
    expect(screen.getByRole("link", { name: "← Back to topic" }))
      .toHaveAttribute("href", `/app/topics/${currentTopic.id}`);

    await user.click(screen.getByRole("button", { name: "Check my answers" }));
    await user.click(screen.getByRole("button", { name: "good" }));

    expect(await screen.findByRole("heading", { name: "Review complete" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Return to topic" }))
      .toHaveAttribute("href", `/app/topics/${currentTopic.id}`);
  });
});
