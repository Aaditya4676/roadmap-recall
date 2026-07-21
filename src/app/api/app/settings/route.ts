import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";
import { getTopics } from "@/lib/data";
import { replayScheduler } from "@/lib/scheduler";
import { selectAllByOwner } from "@/lib/supabase/pagination";

const schema = z.object({
  timeZone: z.string().min(3).max(80),
  defaultScheduler: z.enum(["fsrs", "fixed"]),
  defaultKeepWarmDays: z.union([z.literal(14), z.literal(30), z.literal(60), z.null()]),
  reminderEnabled: z.boolean(),
  aiActionSharePersonalNotes: z.boolean(),
  migrateExisting: z.boolean().default(false),
});

export async function PATCH(request: NextRequest) {
  try {
    const { db, user } = await requireOwnerRequest(request);
    const body = schema.parse(await request.json());
    try { new Intl.DateTimeFormat("en", { timeZone: body.timeZone }).format(); }
    catch { throw new HttpError(400, "Unknown IANA timezone.", "invalid_timezone"); }

    if (body.migrateExisting) {
      const topics = await getTopics(db);
      const events = await selectAllByOwner(db, "review_events", user.id, "topic_id, reviewed_at, rating");
      const migrations = [];
      for (const topic of topics.filter((item) => item.scheduler !== body.defaultScheduler)) {
        const history = events.filter((event) => event.topic_id === topic.id).map((event) => ({ reviewedAt: event.reviewed_at, rating: event.rating }));
        const next = replayScheduler(body.defaultScheduler, topic.learnedOn, history, topic.keepWarmDays, body.timeZone);
        migrations.push({ topicId: topic.id, expectedReviewCount: topic.reviewState.reviewCount, nextState: next });
      }
      const { error: migrationError } = await db.rpc("migrate_topic_schedulers_batch", { p_items: migrations, p_default_scheduler: body.defaultScheduler });
      if (migrationError?.code === "40001") throw new HttpError(409, "A topic changed during migration. No scheduler states were changed.", "revision_conflict");
      if (migrationError) throw migrationError;
    }

    const { error } = await db.from("profiles").update({
      time_zone: body.timeZone,
      default_scheduler: body.defaultScheduler,
      default_keep_warm_days: body.defaultKeepWarmDays,
      reminder_enabled: body.reminderEnabled,
      ai_action_share_personal_notes: body.aiActionSharePersonalNotes,
    }).eq("id", user.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: { code: "invalid_body", issues: error.issues } }, { status: 400 });
    return errorResponse(error);
  }
}
