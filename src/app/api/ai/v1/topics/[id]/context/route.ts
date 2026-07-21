import { NextRequest } from "next/server";
import { decodeCursor, encodeCursor, logAiAction, requireAiAction } from "@/lib/ai/action-auth";
import { errorResponse, HttpError } from "@/lib/auth";

const CHUNK = 24_000;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let audit: Awaited<ReturnType<typeof requireAiAction>> | undefined;
  try {
    audit = await requireAiAction(request);
    const { id } = await context.params;
    const offset = decodeCursor(new URL(request.url).searchParams.get("cursor"));
    const { data: topic, error } = await audit.db.from("study_topics").select("id, title, breadcrumb, kind, part, personal_notes(markdown, revision), ai_notes(revision, source_note_revision)").eq("owner_id", audit.owner.id).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!topic) throw new HttpError(404, "Topic not found.", "not_found");
    const personal: any = Array.isArray(topic.personal_notes) ? topic.personal_notes[0] : topic.personal_notes;
    const ai: any = Array.isArray(topic.ai_notes) ? topic.ai_notes[0] : topic.ai_notes;
    if (!personal) throw new HttpError(409, "This topic has no personal-note record. Repair it in the owner workspace first.", "missing_personal_note");
    const fullText = audit.owner.ai_action_share_personal_notes ? personal.markdown : "";
    const chunk = fullText.slice(offset, offset + CHUNK);
    const response = {
      topic: { id: topic.id, title: topic.title, breadcrumb: topic.breadcrumb, kind: topic.kind, part: topic.part },
      personalNote: audit.owner.ai_action_share_personal_notes ? { revision: personal.revision, markdownChunk: chunk, contentOffset: offset } : null,
      consent: audit.owner.ai_action_share_personal_notes,
      consentMessage: audit.owner.ai_action_share_personal_notes ? "Owner enabled personal-note context." : "Personal-note sharing is disabled. Generate from topic metadata only.",
      currentAiNoteRevision: ai?.revision ?? 0,
      nextCursor: offset + chunk.length < fullText.length ? encodeCursor(offset + chunk.length) : null,
    };
    if (JSON.stringify(response).length > 60_000) throw new HttpError(500, "Context response exceeded its internal safety limit.", "response_too_large");
    await logAiAction(audit.db, audit.fingerprint, audit.route, 200);
    return Response.json(response);
  } catch (error) {
    if (audit) await logAiAction(audit.db, audit.fingerprint, audit.route, error instanceof HttpError ? error.status : 500);
    return errorResponse(error);
  }
}
