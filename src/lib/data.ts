import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiNoteRecord, StudyTopic } from "@/lib/domain/types";
import { selectAllByOwner } from "@/lib/supabase/pagination";

function mapTopic(row: any): StudyTopic {
  const note = Array.isArray(row.personal_notes) ? row.personal_notes[0] : row.personal_notes;
  const state = Array.isArray(row.review_states) ? row.review_states[0] : row.review_states;
  const ai = Array.isArray(row.ai_notes) ? row.ai_notes[0] : row.ai_notes;
  const aiNote: AiNoteRecord | undefined = ai ? {
    id: ai.id,
    document: ai.document,
    revision: ai.revision,
    sourceNoteRevision: ai.source_note_revision,
    provider: ai.provider,
    model: ai.model,
    createdAt: ai.created_at,
    updatedAt: ai.updated_at,
    hidden: ai.hidden,
  } : undefined;
  return {
    id: row.id,
    title: row.title,
    breadcrumb: row.breadcrumb,
    kind: row.kind,
    part: row.part,
    learnedOn: row.learned_on,
    activatedAt: row.activated_at,
    scheduler: row.scheduler,
    keepWarmDays: row.keep_warm_days,
    note: {
      markdown: note?.markdown ?? "",
      revision: note?.revision ?? 1,
      updatedAt: note?.updated_at ?? row.updated_at,
    },
    reviewState: {
      scheduler: state.scheduler,
      dueAt: state.due_at,
      dueOn: state.due_on,
      lastReviewedAt: state.last_reviewed_at,
      reviewCount: state.review_count,
      fixedStage: state.fixed_stage,
      fsrsCard: state.fsrs_card,
    },
    aiNote,
  };
}

const topicSelection = "*, personal_notes(*), review_states(*), ai_notes(*)";

export async function getTopics(db: SupabaseClient): Promise<StudyTopic[]> {
  const { data: userData, error: userError } = await db.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("Authentication required.");
  const data = await selectAllByOwner(db, "study_topics", userData.user.id, topicSelection);
  return data.filter((row) => !row.archived).sort((a, b) => String(b.activated_at).localeCompare(String(a.activated_at))).map(mapTopic);
}

export async function getTopic(db: SupabaseClient, id: string): Promise<StudyTopic | null> {
  const { data, error } = await db.from("study_topics").select(topicSelection).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapTopic(data) : null;
}
