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
    make("demo-closures", "JavaScript closures", "5. JavaScript deeply · Functions and scope", "## In my words\n\nA closure is a function bundled with references to its lexical environment. The references remain reachable after the outer function returns.\n\n```js\nfunction counter() {\n  let n = 0;\n  return () => ++n;\n}\n```\n\n**Watch for:** stale closures in React effects.", 0, {
      aiNote: {
        id: "ai-closures",
        revision: 1,
        sourceNoteRevision: 1,
        provider: "gemini",
        model: "gemini-2.5-flash",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        hidden: false,
        document: {
          summary: "Closures preserve access to bindings from the lexical scope where a function was created.",
          keyPoints: ["They capture bindings, not frozen values.", "They power factories, memoization and data privacy."],
          mentalModel: "A function carries a live backpack of the outer bindings it still references.",
          pitfalls: ["Loop-variable capture", "Stale state in callbacks", "Accidental retention of large objects"],
          recallQuestions: [{ question: "Why does a returned inner function still see outer variables?", answer: "Its lexical environment remains reachable through the closure." }],
          practiceIdeas: ["Implement once(fn) without mutating the original function."],
          connections: ["Lexical scope", "React hook dependencies", "Garbage collection"],
        },
      },
    }),
    make("demo-event-loop", "Event loop and microtasks", "5. JavaScript deeply · Runtime behavior", "Promise callbacks run as microtasks after the current stack and before the next task. I should trace output rather than guess.", -2),
    make("demo-react-render", "React rendering model", "7. React · Rendering and reconciliation", "A render calculates the next UI snapshot. Commit applies changes. State belongs to a position in the tree, not to a JSX tag instance.", 0),
    make("demo-a11y", "Accessible modal dialogs", "2. HTML and accessibility · Accessibility", "Need initial focus, contained Tab movement, Escape close, labelled dialog, and focus restoration.", 3, { kind: "drill" }),
    make("demo-css", "Stacking contexts", "3. CSS · Core CSS", "A high z-index cannot escape its stacking context. First identify which properties create new contexts.", 5),
    make("demo-web-vitals", "Core Web Vitals", "10. Performance · User-centric metrics", "LCP = loading, INP = responsiveness, CLS = visual stability. Diagnose with field data before lab profiling.", 8),
    make("demo-hooks", "useDebounce with cleanup", "16. Frontend drills · Custom hooks", "Contract: cancel stale timer on dependency change and unmount; work under StrictMode; define leading/trailing behavior.", 1, { kind: "drill" }),
    make("demo-system-design", "Autocomplete system design", "15. Frontend system design · Search experiences", "Cover debouncing, cancellation, cache, request identity, keyboard UX, accessibility, ranking, errors and observability.", 12, { kind: "project" }),
    make("demo-http", "HTTP caching", "23. Backend extension · Networking", "Cache-Control controls freshness. Validators allow conditional requests. Shared caches need correct Vary behavior.", 6, { part: "fullstack" }),
    make("demo-node", "Node.js streams", "24. Backend extension · Node.js", "Streams bound memory and support backpressure; don't buffer an entire large payload when processing incrementally.", 14, { part: "fullstack" }),
  ];
}
