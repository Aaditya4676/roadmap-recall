import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, requireOwnerRequest } from "@/lib/auth";
import { validateBackup } from "@/lib/backup";

const schema = z.object({ backup: z.unknown(), dryRun: z.literal(true) });

export async function POST(request: NextRequest) {
  try {
    await requireOwnerRequest(request);
    const body = schema.parse(await request.json());
    const { backup, counts, warnings } = validateBackup(body.backup);
    const ids = new Set((backup.data.study_topics ?? []).map((row) => row.id));
    const orphanNotes = (backup.data.personal_notes ?? []).filter((row) => !ids.has(row.topic_id)).length;
    if (orphanNotes) warnings.push(`${orphanNotes} personal notes reference a topic absent from this backup.`);
    return Response.json({ valid: warnings.length === 0, schemaVersion: backup.schemaVersion, exportedAt: backup.exportedAt, counts, warnings, message: "Dry run only: no database rows were changed. Restore application is intentionally a separate, explicit operator step." });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: { code: "invalid_backup", issues: error.issues } }, { status: 400 });
    return errorResponse(error);
  }
}
