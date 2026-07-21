import { addCalendarDays, dateKey, zonedNoonTimestamp } from "@/lib/date";
import type { StudyTopic } from "@/lib/domain/types";
import { createReviewState } from "@/lib/scheduler";

export function createDemoTopics(now = new Date()): StudyTopic[] {
  const today = dateKey(now);
  const make = (
    id: string,
    title: string,
    breadcrumb: string,
    note: string,
    dueOffset: number,
    options: Partial<StudyTopic> = {},
  ): StudyTopic => {
    const learnedOn = addCalendarDays(today, -8);
    const state = createReviewState("fixed", new Date(`${learnedOn}T05:00:00Z`));
    state.dueOn = addCalendarDays(today, dueOffset);
    state.dueAt = zonedNoonTimestamp(state.dueOn);
    return {
      id,
      title,
      breadcrumb,
      kind: "knowledge",
      part: "frontend",
      learnedOn,
      activatedAt: `${learnedOn}T05:00:00.000Z`,
      scheduler: "fixed",
      keepWarmDays: 30,
      note: { markdown: note, revision: 1, updatedAt: now.toISOString() },
      reviewState: state,
      ...options,
    };
  };

  return [
    make("demo-active-recall", "Active recall", "Learning science · Memory", "## In my words\n\nActive recall means trying to reconstruct an idea before looking at the answer. The effort of retrieval is the useful part, even when my first attempt is incomplete.", 0, {
      aiNote: {
        id: "ai-active-recall",
        revision: 1,
        sourceNoteRevision: 1,
        provider: "gemini",
        model: "gemini-2.5-flash",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        hidden: false,
        document: {
          summary: "Active recall strengthens access to knowledge by requiring retrieval instead of recognition.",
          keyPoints: ["Attempt an answer before revealing notes.", "Use feedback to correct the retrieved answer, not merely reread it."],
          mentalModel: "Practice finding the path to an idea, not just recognizing the destination.",
          pitfalls: ["Revealing the answer too quickly", "Mistaking familiarity for recall", "Reviewing without corrective feedback"],
          recallQuestions: [{ question: "Why is a difficult retrieval attempt useful?", answer: "The retrieval effort strengthens later access when followed by feedback." }],
          practiceIdeas: ["Close a source and write three claims you remember before checking it."],
          connections: ["Spaced repetition", "Testing effect", "Metacognition"],
        },
      },
    }),
    make("demo-compound-interest", "Compound interest", "Personal finance · Growth", "Interest is added to the principal, so later interest is earned on both the original amount and prior interest. The growth is exponential when the rate stays constant.", -2),
    make("demo-photosynthesis", "Photosynthesis", "Biology · Energy", "Plants use light energy to turn carbon dioxide and water into glucose and oxygen. Light-dependent reactions capture energy; the Calvin cycle uses it to fix carbon.", 0),
    make("demo-probability", "Bayes’ theorem", "Mathematics · Probability", "Update a prior belief using how likely the evidence is under each competing explanation. I should calculate with concrete frequencies when percentages feel abstract.", 3, { kind: "drill" }),
    make("demo-argument", "Building a clear argument", "Writing · Structure", "State the claim, give relevant evidence, explain why the evidence supports it, and address the strongest reasonable counterargument.", 5),
    make("demo-spanish", "Ser and estar", "Languages · Spanish", "Both translate to “to be,” but ser usually describes identity or defining traits while estar describes state or location. Context matters more than a permanent-versus-temporary shortcut.", 8),
    make("demo-feynman", "Feynman explanation drill", "Practice · Explanation", "Explain the idea in plain language, notice where the explanation becomes vague, return to the source, and simplify again without losing accuracy.", 1, { kind: "drill" }),
    make("demo-source-check", "Evaluating a source", "Research · Evidence", "Check who produced it, what claim it actually supports, how the evidence was gathered, whether better primary sources exist, and what incentives may shape it.", 12, { kind: "project" }),
    make("demo-http", "HTTP caching", "Technology · Web basics", "Cache-Control defines freshness. Validators such as ETag allow a client to ask whether stale content has changed instead of downloading it again.", 6, { part: "fullstack" }),
    make("demo-speaking", "Opening a presentation", "Communication · Presentations", "Give the audience a reason to care, state the question or outcome, and preview the route. Avoid spending the opening on apologies or background they do not yet need.", 14, { part: "fullstack" }),
  ];
}
