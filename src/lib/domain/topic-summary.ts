export interface TopicSummary {
  id: string;
  title: string;
  breadcrumb: string;
  dueOn: string;
  hasVisibleAiNote: boolean;
}

function relationRows<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function mapTopicSummaryRow(row: any): TopicSummary {
  const state = relationRows<{ due_on?: unknown }>(row.review_states)[0];
  if (typeof state?.due_on !== "string") {
    throw new Error(`Topic ${String(row.id)} is missing a valid review state.`);
  }
  const aiNotes = relationRows<{ hidden?: unknown }>(row.ai_notes);
  return {
    id: String(row.id),
    title: String(row.title),
    breadcrumb: String(row.breadcrumb),
    dueOn: state.due_on,
    hasVisibleAiNote: aiNotes.some((note) => note.hidden === false),
  };
}
