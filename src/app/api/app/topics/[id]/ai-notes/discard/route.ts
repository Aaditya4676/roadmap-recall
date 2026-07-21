import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";

const schema = z.object({ expectedRevision: z.number().int().positive() });

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireOwnerRequest(request);
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const { error } = await db.rpc("discard_ai_note_versioned", { p_topic_id: id, p_expected_revision: body.expectedRevision });
    if (error?.code === "P0002") throw new HttpError(404, "AI note not found.", "not_found");
    if (error?.code === "40001") throw new HttpError(409, "The AI note changed. Reload before discarding it.", "revision_conflict");
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: { code: "invalid_body", issues: error.issues } }, { status: 400 });
    return errorResponse(error);
  }
}
