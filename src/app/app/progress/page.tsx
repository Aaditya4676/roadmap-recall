import { PageHeading } from "@/components/page-heading";
import { selectAllByOwner } from "@/lib/supabase/pagination";
import { createServerSupabase, getAuthenticatedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const db = await createServerSupabase();
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required.");
  const [rows, { count: reviews }] = await Promise.all([
    selectAllByOwner(db, "study_topics", user.id, "part, kind, archived, ai_notes(hidden)"),
    db.from("review_events").select("id", { count: "exact", head: true }),
  ]);
  const topics = rows.filter((topic) => !topic.archived);
  const primary = topics.filter((topic) => topic.part === "frontend").length;
  const extension = topics.length - primary;
  const practice = topics.filter((topic) => topic.kind !== "knowledge").length;
  const withAi = topics.filter((topic) => {
    const notes = Array.isArray(topic.ai_notes) ? topic.ai_notes : topic.ai_notes ? [topic.ai_notes] : [];
    return notes.some((note: { hidden: boolean }) => !note.hidden);
  }).length;
  return <><PageHeading eyebrow="Progress without pressure" title="Evidence of learning" description="A quiet record of active topics and completed recall—not a streak that punishes real life." /><dl className="grid grid-cols-3 divide-x divide-[var(--border)] border-y border-[var(--border)]"><Metric value={topics.length} label="active study topics" accent /><Metric value={reviews ?? 0} label="reviews completed" /><Metric value={withAi} label="with optional AI notes" /></dl><section className="card mt-6 p-6"><h2 className="text-xl font-bold">Learning mix</h2><div className="mt-6 grid gap-5"><Line label="Primary plan" value={primary} total={topics.length} /><Line label="Extension plan" value={extension} total={topics.length} /><Line label="Practice and projects" value={practice} total={topics.length} /></div></section></>;
}
function Metric({ value, label, accent }: { value: number; label: string; accent?: boolean }) { return <div className="flex min-w-0 flex-col px-3 py-4 sm:px-5"><dt className="order-2 mt-1 text-sm text-[var(--muted)]">{label}</dt><dd className={`order-1 text-3xl font-bold ${accent ? "text-[var(--accent)]" : ""}`}>{value}</dd></div>; }
function Line({ label, value, total }: { label: string; value: number; total: number }) { const percent = Math.round(value / Math.max(total, 1) * 100); return <div><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">{label}</span><span className="text-[var(--muted)]">{value} · {percent}%</span></div><div className="h-2 rounded-full bg-[var(--subtle)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${percent}%` }} /></div></div>; }
