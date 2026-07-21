import { NextRequest } from "next/server";
import { errorResponse, HttpError } from "@/lib/auth";
import { decodeCursor, encodeCursor, logAiAction, requireAiAction } from "@/lib/ai/action-auth";
import { selectAllByOwner } from "@/lib/supabase/pagination";

export async function GET(request: NextRequest) {
  let audit: Awaited<ReturnType<typeof requireAiAction>> | undefined;
  try {
    audit = await requireAiAction(request);
    const url = new URL(request.url);
    const states = new Set((url.searchParams.get("state") ?? "missing,stale").split(",").map((state) => state.trim()).filter(Boolean));
    if ([...states].some((state) => !["missing", "stale"].includes(state))) throw new HttpError(400, "state supports missing and stale.", "invalid_state");
    const requestedLimit = Number(url.searchParams.get("limit") ?? 5);
    if (!Number.isInteger(requestedLimit)) throw new HttpError(400, "limit must be an integer from 1 to 5.", "invalid_limit");
    const limit = Math.min(Math.max(requestedLimit, 1), 5);
    const offset = decodeCursor(url.searchParams.get("cursor"));
    const data = await selectAllByOwner(audit.db, "study_topics", audit.owner.id, "id, title, breadcrumb, kind, part, activated_at, archived, personal_notes(revision), ai_notes(revision, source_note_revision, hidden)");
    const eligible = data.filter((topic: any) => !topic.archived).sort((a: any, b: any) => String(b.activated_at).localeCompare(String(a.activated_at))).map((topic: any) => {
      const personal = Array.isArray(topic.personal_notes) ? topic.personal_notes[0] : topic.personal_notes;
      const ai = Array.isArray(topic.ai_notes) ? topic.ai_notes[0] : topic.ai_notes;
      if (!personal) return null;
      const state = !ai ? "missing" : ai.source_note_revision < personal.revision ? "stale" : "current";
      return { id: topic.id, title: topic.title, breadcrumb: topic.breadcrumb, kind: topic.kind, part: topic.part, state, personalNoteRevision: personal.revision, aiNoteRevision: ai?.revision ?? 0 };
    }).filter((topic: any) => topic && states.has(topic.state));
    const items = eligible.slice(offset, offset + limit);
    const response = { items, nextCursor: offset + limit < eligible.length ? encodeCursor(offset + limit) : null };
    await logAiAction(audit.db, audit.fingerprint, audit.route, 200);
    return Response.json(response);
  } catch (error) {
    if (audit) await logAiAction(audit.db, audit.fingerprint, audit.route, error instanceof HttpError ? error.status : 500);
    return errorResponse(error);
  }
}
