import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";
import { generateAiNote } from "@/lib/ai/provider";

export const maxDuration = 120;

const schema = z.object({ provider: z.enum(["gemini", "zai"]), includePersonalNotes: z.boolean().default(false) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let attemptId: string | undefined;
  let dbForFailure: any;
  try {
    const { db, user } = await requireOwnerRequest(request);
    dbForFailure = db;
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const { data: topic, error } = await db.from("study_topics").select("title, breadcrumb, kind, personal_notes(markdown, revision), ai_notes(revision)").eq("id", id).single();
    if (error || !topic) throw new HttpError(404, "Topic not found.", "not_found");
    const personal = Array.isArray(topic.personal_notes) ? topic.personal_notes[0] : topic.personal_notes;
    const currentAi = Array.isArray(topic.ai_notes) ? topic.ai_notes[0] : topic.ai_notes;
    if (!personal) throw new HttpError(409, "This topic has no personal-note record. Export your data and repair it before generating AI notes.", "missing_personal_note");
    const requestChars = topic.title.length + topic.breadcrumb.length + (body.includePersonalNotes ? personal.markdown.length : 0);
    const model = body.provider === "gemini" ? process.env.GEMINI_MODEL ?? "gemini-2.5-flash" : process.env.ZAI_MODEL ?? "glm-4.5-flash";
    const { data: attempt, error: attemptError } = await db.from("ai_generation_attempts").insert({ owner_id: user.id, topic_id: id, provider: body.provider, model, status: "started", source_note_revision: personal.revision, request_chars: requestChars }).select("id").single();
    if (attemptError) throw attemptError;
    attemptId = attempt.id;

    const generated = await generateAiNote(body.provider, { title: topic.title, breadcrumb: topic.breadcrumb, kind: topic.kind, personalMarkdown: body.includePersonalNotes ? personal.markdown : undefined });
    const { data: saved, error: saveError } = await db.rpc("upsert_ai_note_versioned", { p_owner_id: user.id, p_topic_id: id, p_expected_revision: currentAi?.revision ?? 0, p_document: generated.document, p_source_note_revision: personal.revision, p_provider: body.provider, p_model: generated.model });
    if (saveError?.code === "40001") throw new HttpError(409, "Your personal note or AI note changed while generation was running. Review the newer revision before replacing it.", "revision_conflict");
    if (saveError) throw saveError;
    await db.from("ai_generation_attempts").update({ status: "succeeded", response_chars: JSON.stringify(generated.document).length, finished_at: new Date().toISOString() }).eq("id", attemptId);
    return Response.json({ note: saved });
  } catch (error) {
    if (attemptId && dbForFailure) await dbForFailure.from("ai_generation_attempts").update({ status: "failed", error_code: (error as any)?.code ?? "generation_failed", error_message: error instanceof Error ? error.message.slice(0, 1_000) : "Unknown error", finished_at: new Date().toISOString() }).eq("id", attemptId);
    if (error instanceof z.ZodError) return Response.json({ error: { code: "invalid_body", issues: error.issues } }, { status: 400 });
    return errorResponse(error);
  }
}
