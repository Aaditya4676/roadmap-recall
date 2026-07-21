import { NextRequest } from "next/server";
import { z } from "zod";
import { logAiAction, requireAiAction } from "@/lib/ai/action-auth";
import { aiUpsertSchema } from "@/lib/ai/schema";
import { errorResponse, HttpError } from "@/lib/auth";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let audit: Awaited<ReturnType<typeof requireAiAction>> | undefined;
  try {
    audit = await requireAiAction(request);
    const { id } = await context.params;
    const body = aiUpsertSchema.parse(await request.json());
    const { data: topic, error: topicError } = await audit.db.from("study_topics").select("personal_notes(revision)").eq("owner_id", audit.owner.id).eq("id", id).maybeSingle();
    if (topicError) throw topicError;
    if (!topic) throw new HttpError(404, "Topic not found.", "not_found");
    const personal: any = Array.isArray(topic.personal_notes) ? topic.personal_notes[0] : topic.personal_notes;
    if (!personal) throw new HttpError(409, "This topic has no personal-note record.", "missing_personal_note");
    if (personal.revision !== body.sourceNoteRevision) throw new HttpError(409, "Personal note changed after context was read. Fetch fresh context before writing AI notes.", "source_revision_conflict");
    const { data, error } = await audit.db.rpc("upsert_ai_note_versioned", { p_owner_id: audit.owner.id, p_topic_id: id, p_expected_revision: body.expectedRevision, p_document: body.document, p_source_note_revision: body.sourceNoteRevision, p_provider: "external", p_model: body.model });
    if (error?.code === "40001") throw new HttpError(409, "Personal or AI note revision conflict. Fetch fresh context before replacing it.", "revision_conflict");
    if (error) throw error;
    await logAiAction(audit.db, audit.fingerprint, audit.route, 200);
    return Response.json({ id: data.id, revision: data.revision, updatedAt: data.updated_at });
  } catch (error) {
    if (audit) await logAiAction(audit.db, audit.fingerprint, audit.route, error instanceof HttpError ? error.status : 500);
    if (error instanceof z.ZodError) return Response.json({ error: { code: "invalid_body", issues: error.issues } }, { status: 400 });
    return errorResponse(error);
  }
}
