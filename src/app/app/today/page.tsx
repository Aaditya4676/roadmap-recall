import { Brain, CheckCircle2, ChevronDown, Clock3, Sparkles } from "lucide-react";
import Link from "next/link";
import { CaptureTopic } from "@/components/capture-topic";
import { PageHeading } from "@/components/page-heading";
import { dateKey, humanDate, isDue, isOverdue } from "@/lib/date";
import { getTopicSummaries } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const db = await createServerSupabase();
  const [{ data: profile }, topics] = await Promise.all([
    db.from("profiles").select("time_zone").single(),
    getTopicSummaries(db),
  ]);
  const today = dateKey(new Date(), profile?.time_zone);
  const due = topics.filter((topic) => isDue(topic.dueOn, today)).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const upcoming = topics.filter((topic) => topic.dueOn > today).sort((a, b) => a.dueOn.localeCompare(b.dueOn)).slice(0, 7);
  const overdue = due.filter((topic) => isOverdue(topic.dueOn, today)).length;

  return (
    <>
      <PageHeading
        eyebrow={new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: profile?.time_zone }).format(new Date())}
        title={due.length ? "A small set to revisit" : "You’re clear for today"}
        description="Two focused minutes per topic. Recall first, then reveal what you wrote."
        action={<CaptureTopic />}
      />

      <dl className="metric-strip grid grid-cols-3 divide-x divide-[var(--border)] border-y">
        <Stat value={due.length} label="due today" accent />
        <Stat value={overdue} label="carried forward" />
        <Stat value={`~${due.length * 2} min`} label="estimated time" />
      </dl>

      <section className="liquid-panel mt-6 overflow-hidden rounded-[12px]" data-liquid>
        <div className="glass-divider flex flex-wrap items-center justify-between gap-4 border-b p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-bold">Today’s review</h2>
            <p className="text-sm text-[var(--muted)]">Late topics wait calmly—there is no broken streak.</p>
          </div>
          {due.length > 0 && <Link className="button-primary" data-liquid href="/app/review"><Brain size={18} /> Start review</Link>}
        </div>
        {due.length ? (
          <div className="divide-y divide-[var(--border)]">
            {due.map((topic) => (
              <Link href={`/app/topics/${topic.id}`} key={topic.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-[color:var(--subtle)]/65 sm:px-6">
                <Clock3 size={18} className="shrink-0 text-[var(--muted)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{topic.title}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{topic.breadcrumb}</span>
                </span>
                {topic.hasVisibleAiNote && <Sparkles size={16} className="text-[var(--plum)]" aria-label="AI notes available" />}
                <span className="text-xs font-bold text-[var(--muted)]">{isOverdue(topic.dueOn, today) ? "Waiting" : "Today"}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <CheckCircle2 size={36} className="mx-auto text-[var(--accent)]" />
            <p className="mt-3 font-semibold">Nothing needs attention now.</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Capture the next idea after you learn it.</p>
          </div>
        )}
      </section>

      <details className="content-surface mt-6 group">
        <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-bold sm:p-6">Coming up <ChevronDown className="transition group-open:rotate-180" size={18} /></summary>
        <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {upcoming.length ? upcoming.map((topic) => (
            <Link key={topic.id} href={`/app/topics/${topic.id}`} className="flex justify-between gap-4 px-5 py-3 text-sm transition-colors hover:bg-[color:var(--subtle)]/65">
              <span className="font-medium">{topic.title}</span>
              <span className="shrink-0 text-[var(--muted)]">{humanDate(topic.dueOn)}</span>
            </Link>
          )) : <p className="p-5 text-sm text-[var(--muted)]">No upcoming topics yet.</p>}
        </div>
      </details>
    </>
  );
}

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col px-3 py-4 sm:px-5">
      <dt className="order-2 mt-1 truncate text-xs text-[var(--muted)] sm:text-sm">{label}</dt>
      <dd className={`order-1 truncate text-2xl font-bold sm:text-3xl ${accent ? "text-[var(--accent)]" : ""}`}>{value}</dd>
    </div>
  );
}
