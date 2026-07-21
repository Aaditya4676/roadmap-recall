import { NextRequest } from "next/server";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireOwnerRequest(request);
    const { id } = await context.params;
    const { data, error } = await db.from("ai_notes").update({ hidden: true }).eq("topic_id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "AI note not found.", "not_found");
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
