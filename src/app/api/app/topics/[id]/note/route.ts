import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";

const schema = z.object({ markdown: z.string().max(100_000), expectedRevision: z.number().int().positive() });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireOwnerRequest(request);
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const { data, error } = await db.from("personal_notes").update({ markdown: body.markdown, revision: body.expectedRevision + 1 }).eq("topic_id", id).eq("revision", body.expectedRevision).select("revision, updated_at").maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(409, "Your note changed in another tab or device. Reload before saving again.", "revision_conflict");
    return Response.json({ revision: data.revision, updatedAt: data.updated_at });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: { code: "invalid_body", issues: error.issues } }, { status: 400 });
    return errorResponse(error);
  }
}
