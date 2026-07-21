import { NextRequest } from "next/server";
import { Resend } from "resend";
import { errorResponse } from "@/lib/auth";
import { escapeHtml, requireCron } from "@/lib/cron";
import { dateKey } from "@/lib/date";
import { env } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const maxDuration = 60;

async function getAllDue(db: ReturnType<typeof createAdminSupabase>, ownerId: string, today: string) {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from("review_states").select("topic_id, due_on, study_topics!inner(title, archived)").eq("owner_id", ownerId).lte("due_on", today).eq("study_topics.archived", false).order("due_on").range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

export async function GET(request: NextRequest) {
  try {
    requireCron(request);
    if (!env.RESEND_API_KEY || !env.RESEND_FROM || !env.APP_URL) throw new Error("Resend and APP_URL must be configured for reminders.");
    const db = createAdminSupabase(); const resend = new Resend(env.RESEND_API_KEY);
    const { data: profiles, error } = await db.from("profiles").select("id, email, time_zone").eq("reminder_enabled", true);
    if (error) throw error;
    const results = [];
    for (const profile of profiles ?? []) {
      const today = dateKey(new Date(), profile.time_zone);
      const due = await getAllDue(db, profile.id, today);
      if (!due?.length) { results.push({ owner: profile.id, status: "no_due" }); continue; }
      let { data: claimed, error: claimError } = await db.from("reminder_deliveries").insert({ owner_id: profile.id, delivery_on: today, due_count: due.length, topic_ids: due.map((row) => row.topic_id), status: "sending" }).select("id, status, updated_at").maybeSingle();
      if (claimError?.code === "23505") {
        const { data: existing, error: existingError } = await db.from("reminder_deliveries").select("id, status, updated_at").eq("owner_id", profile.id).eq("delivery_on", today).single();
        if (existingError) throw existingError;
        const inFlight = existing.status === "sending" && Date.now() - Date.parse(existing.updated_at) < 15 * 60_000;
        if (existing.status === "sent" || inFlight) { results.push({ owner: profile.id, status: existing.status === "sent" ? "already_sent" : "in_flight" }); continue; }
        const retried = await db.from("reminder_deliveries").update({ status: "sending", due_count: due.length, topic_ids: due.map((row) => row.topic_id), error_message: null }).eq("id", existing.id).eq("status", existing.status).eq("updated_at", existing.updated_at).select("id, status, updated_at").maybeSingle();
        if (retried.error) throw retried.error;
        if (!retried.data) { results.push({ owner: profile.id, status: "in_flight" }); continue; }
        claimed = retried.data; claimError = null;
      }
      if (claimError || !claimed) throw claimError ?? new Error("Could not claim reminder delivery.");
      const titles = due.slice(0, 12).map((row: any) => `<li>${escapeHtml(row.study_topics.title)}</li>`).join("");
      const { data: sent, error: sendError } = await resend.emails.send({ from: env.RESEND_FROM, to: profile.email, subject: `${due.length} ${due.length === 1 ? "topic" : "topics"} ready to revisit`, html: `<div style="font-family:system-ui;line-height:1.55;max-width:560px"><h1 style="font-size:24px">A small review is ready</h1><p>${due.length} ${due.length === 1 ? "topic is" : "topics are"} due today—about ${due.length * 2} minutes.</p><ul>${titles}</ul><p><a href="${env.APP_URL}/app/today">Open Roadmap Recall</a></p><p style="color:#687573;font-size:13px">This reminder intentionally contains no note contents.</p></div>` }, { idempotencyKey: `roadmap-reminder-${profile.id}-${today}` });
      if (sendError) { await db.from("reminder_deliveries").update({ status: "failed", error_message: sendError.message }).eq("id", claimed.id); results.push({ owner: profile.id, status: "failed" }); continue; }
      await db.from("reminder_deliveries").update({ status: "sent", provider_message_id: sent?.id }).eq("id", claimed.id);
      results.push({ owner: profile.id, status: "sent", count: due.length });
    }
    return Response.json({ results });
  } catch (error) { return errorResponse(error); }
}
