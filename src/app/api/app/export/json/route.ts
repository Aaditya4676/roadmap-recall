import { NextRequest } from "next/server";
import { errorResponse, requireOwnerRequest } from "@/lib/auth";
import { buildBackup } from "@/lib/backup";

export async function GET(request: NextRequest) {
  try {
    const { db, user } = await requireOwnerRequest(request);
    const backup = await buildBackup(db, user.id);
    return new Response(JSON.stringify(backup, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="roadmap-recall-${backup.exportedAt.slice(0, 10)}.json"`, "cache-control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
