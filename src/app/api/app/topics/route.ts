import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, HttpError, requireOwnerRequest } from "@/lib/auth";
import { dateKey } from "@/lib/date";
import { createReviewStateFromDay } from "@/lib/scheduler";

const createSchema = z.object({
  roadmapItemId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(240).optional(),
  breadcrumb: z.string().trim().max(500).optional(),
  note: z.string().max(100_000).default(""),
  learnedOn: z.string().date().optional(),
  scheduler: z.enum(["fsrs", "fixed"]).optional(),
  keepWarmDays: z.union([z.literal(14), z.literal(30), z.literal(60), z.null()]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { db, user } = await requireOwnerRequest(request);
    const body = createSchema.parse(await request.json());
    const { data: profile, error: profileError } = await db.from("profiles").select("time_zone, default_scheduler, default_keep_warm_days").eq("id", user.id).single();
    if (profileError) throw profileError;

    let title = body.title;
    let breadcrumb = body.breadcrumb ?? "Personal topics";
    let kind: "knowledge" | "drill" = "knowledge";
    let part: "frontend" | "fullstack" = "frontend";
    if (body.roadmapItemId) {
      const { data: item, error } = await db.from("roadmap_items").select("title, kind, roadmap_sections!inner(title, section_number, part)").eq("id", body.roadmapItemId).single();
      if (error || !item) throw new HttpError(404, "Roadmap item not found.", "not_found");
      if (item.kind !== "knowledge" && item.kind !== "drill") throw new HttpError(422, "Projects, gates and routines stay in the catalog but are not scheduled.", "not_schedulable");
      const section = item.roadmap_sections as any;
      title = item.title; kind = item.kind; part = section.part;
      breadcrumb = `${section.section_number}. ${section.title}`;
    }
    if (!title) throw new HttpError(400, "A topic title is required.", "invalid_topic");

    const scheduler = body.scheduler ?? profile.default_scheduler;
    const keepWarmDays = body.keepWarmDays === undefined ? profile.default_keep_warm_days : body.keepWarmDays;
    const learnedOn = body.learnedOn ?? dateKey(new Date(), profile.time_zone);
    const activatedAt = new Date();
    const state = createReviewStateFromDay(scheduler, learnedOn, profile.time_zone);
    const { data: topicId, error } = await db.rpc("activate_study_topic", {
      p_roadmap_item_id: body.roadmapItemId ?? null,
      p_title: title,
      p_breadcrumb: breadcrumb,
      p_kind: kind,
      p_part: part,
      p_learned_on: learnedOn,
      p_activated_at: activatedAt.toISOString(),
      p_scheduler: scheduler,
      p_keep_warm_days: keepWarmDays,
      p_due_at: state.dueAt,
      p_due_on: state.dueOn,
      p_fsrs_card: state.fsrsCard,
      p_initial_markdown: body.note,
    });
    if (error) throw error;
    return Response.json({ id: topicId }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: { code: "invalid_body", issues: error.issues } }, { status: 400 });
    return errorResponse(error);
  }
}
