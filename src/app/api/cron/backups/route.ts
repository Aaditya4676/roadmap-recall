import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { Resend } from "resend";
import { errorResponse } from "@/lib/auth";
import { buildBackup, decodeBackupKey, encryptBackup } from "@/lib/backup";
import { requireCron } from "@/lib/cron";
import { dateKey } from "@/lib/date";
import { env } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    requireCron(request);
    if (!env.RESEND_API_KEY || !env.RESEND_FROM || !env.BACKUP_ENCRYPTION_KEY) throw new Error("Resend and backup encryption must be configured.");
    const key = decodeBackupKey(env.BACKUP_ENCRYPTION_KEY);
    const db = createAdminSupabase(); const resend = new Resend(env.RESEND_API_KEY);
    const { data: profiles, error } = await db.from("profiles").select("id, email, time_zone");
    if (error) throw error;
    const results = [];
    for (const profile of profiles ?? []) {
      const backupOn = dateKey(new Date(), profile.time_zone);
      let { data: delivery, error: deliveryError } = await db.from("backup_deliveries").insert({ owner_id: profile.id, backup_on: backupOn, schema_version: 1, key_id: env.BACKUP_KEY_ID, status: "building" }).select("id, status, updated_at").maybeSingle();
      if (deliveryError?.code === "23505") {
        const { data: existing, error: existingError } = await db.from("backup_deliveries").select("id, status, updated_at").eq("owner_id", profile.id).eq("backup_on", backupOn).single();
        if (existingError) throw existingError;
        const inFlight = existing.status === "building" && Date.now() - Date.parse(existing.updated_at) < 30 * 60_000;
        if (existing.status === "sent" || inFlight) { results.push({ owner: profile.id, status: existing.status === "sent" ? "already_sent" : "in_flight" }); continue; }
        const retried = await db.from("backup_deliveries").update({ status: "building", error_message: null, finished_at: null }).eq("id", existing.id).eq("status", existing.status).eq("updated_at", existing.updated_at).select("id, status, updated_at").maybeSingle();
        if (retried.error) throw retried.error;
        if (!retried.data) { results.push({ owner: profile.id, status: "in_flight" }); continue; }
        delivery = retried.data; deliveryError = null;
      }
      if (deliveryError || !delivery) throw deliveryError ?? new Error("Could not claim backup delivery.");
      try {
        const backup = await buildBackup(db, profile.id);
        const envelope = encryptBackup(backup, key, env.BACKUP_KEY_ID);
        const bytes = Buffer.from(JSON.stringify(envelope, null, 2));
        const { data: sent, error: sendError } = await resend.emails.send({ from: env.RESEND_FROM, to: profile.email, subject: `Encrypted Roadmap Recall backup · ${backup.exportedAt.slice(0, 10)}`, html: `<p>Your weekly encrypted Roadmap Recall backup is attached.</p><p>The recovery key is not in this email. Keep the key identified as <strong>${env.BACKUP_KEY_ID}</strong> in your password manager.</p>`, attachments: [{ filename: `roadmap-recall-${backup.exportedAt.slice(0, 10)}.json.enc`, content: bytes }] }, { idempotencyKey: `roadmap-backup-${profile.id}-${backupOn}` });
        if (sendError) throw sendError;
        await db.from("backup_deliveries").update({ status: "sent", sha256: createHash("sha256").update(bytes).digest("hex"), provider_message_id: sent?.id, finished_at: new Date().toISOString() }).eq("id", delivery.id);
        results.push({ owner: profile.id, status: "sent" });
      } catch (cause) {
        await db.from("backup_deliveries").update({ status: "failed", error_message: cause instanceof Error ? cause.message.slice(0, 1_000) : "Unknown error", finished_at: new Date().toISOString() }).eq("id", delivery.id);
        results.push({ owner: profile.id, status: "failed" });
      }
    }
    return Response.json({ results });
  } catch (error) { return errorResponse(error); }
}
