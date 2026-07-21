import { NextRequest } from "next/server";
import { z } from "zod";
import { logAiAction, requireAiAction } from "@/lib/ai/action-auth";
import { aiUpsertSchema } from "@/lib/ai/schema";
import { errorResponse, HttpError } from "@/lib/auth";

const schema = z.object({ notes: z.array(aiUpsertSchema.extend({ topicId: z.string().uuid() })).min(1).max(3) });

export async function POST(request: NextRequest) {
  let audit: Awaited<ReturnType<typeof requireAiAction>> | undefined;
  try {
    audit = await requireAiAction(request);
    const body = schema.parse(await request.json());
    const ids = body.notes.map((note) => note.topicId);
    if (new Set(ids).size !== ids.length) throw new HttpError(400, "A batch cannot repeat a topic.", "duplicate_topic");
    const { data: topics, error: topicError } = await audit.db.from("study_topics").select("id, personal_notes(revision)").eq("owner_id", audit.owner.id).in("id", ids);
    if (topicError) throw topicError;
    if (topics?.length !== ids.length) throw new HttpError(404, "One or more topics were not found.", "not_found");
    for (const note of body.notes) {
      const topic: any = topics.find((candidate: any) => candidate.id === note.topicId);
      const personal = Array.isArray(topic.personal_notes) ? topic.personal_notes[0] : topic.personal_notes;
      if (!personal) throw new HttpError(409, `Topic ${note.topicId} has no personal-note record. Nothing was written.`, "missing_personal_note");
      if (personal.revision !== note.sourceNoteRevision) throw new HttpError(409, `Personal note changed for topic ${note.topicId}. Nothing was written.`, "source_revision_conflict");
    }
    const payload = body.notes.map((note) => ({ ownerId: audit!.owner.id, topicId: note.topicId, expectedRevision: note.expectedRevision, sourceNoteRevision: note.sourceNoteRevision, document: note.document, provider: "external", model: note.model }));
    const { data, error } = await audit.db.rpc("upsert_ai_notes_batch", { p_items: payload });
    if (error?.code === "40001") throw new HttpError(409, "At least one AI note changed. The transactional batch wrote nothing.", "revision_conflict");
    if (error) throw error;
    await logAiAction(audit.db, audit.fingerprint, audit.route, 200);
    return Response.json({ notes: data.map((row: any) => ({ id: row.id, topicId: row.topic_id, revision: row.revision })) });
  } catch (error) {
    if (audit) await logAiAction(audit.db, audit.fingerprint, audit.route, error instanceof HttpError ? error.status : 500);
    if (error instanceof z.ZodError) return Response.json({ error: { code: "invalid_body", issues: error.issues } }, { status: 400 });
    return errorResponse(error);
  }
}
