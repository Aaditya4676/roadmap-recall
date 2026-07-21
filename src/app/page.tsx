import { ArrowRight, Brain, CalendarClock, Check, FileText, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="button-ghost hidden sm:inline-flex">Sign in</Link>
          <Link href="/demo" className="button-secondary">Try the demo</Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:pt-24">
          <div>
            <p className="context-label mb-4">Frontend-first learning companion</p>
            <h1 className="text-balance max-w-3xl text-5xl font-bold leading-[1.06] tracking-[-0.045em] sm:text-6xl">
              Remember what you learn, without managing a spreadsheet.
            </h1>
            <p className="mt-7 max-w-2xl text-balance text-lg leading-relaxed text-[var(--muted)] sm:text-xl">
              Capture a topic in seconds, recall it at the right time, and keep your own notes separate from optional AI explanations.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/demo" className="button-primary !min-h-12 !px-5">Open local demo <ArrowRight size={18} /></Link>
              <Link href="/login" className="button-secondary !min-h-12 !px-5">Set up my space</Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><Check size={16} className="text-[var(--accent)]" /> No streak pressure</span>
              <span className="inline-flex items-center gap-1.5"><Check size={16} className="text-[var(--accent)]" /> Private by default</span>
              <span className="inline-flex items-center gap-1.5"><Check size={16} className="text-[var(--accent)]" /> 795-topic roadmap</span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl">
            <div className="card overflow-hidden p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div><p className="context-label">Monday, 20 July</p><h2 className="mt-1 text-2xl font-bold">Three ideas to revisit</h2></div>
                <span className="rounded-md border border-[var(--border)] px-2.5 py-1 text-sm font-semibold text-[var(--muted)]">~6 min</span>
              </div>
              <div className="mt-6 grid gap-3">
                {["JavaScript closures", "React rendering model", "HTTP caching"].map((topic, index) => (
                  <div key={topic} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--subtle)] text-sm font-bold">{index + 1}</span>
                    <div className="min-w-0"><p className="truncate font-semibold">{topic}</p><p className="text-xs text-[var(--muted)]">{index === 0 ? "Due today" : `${index + 1} days overdue`}</p></div>
                  </div>
                ))}
              </div>
              <div className="button-primary mt-6 w-full"><Brain size={18} /> Start a calm review</div>
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--border)] bg-[color:var(--surface)]/55">
          <div className="mx-auto grid max-w-7xl gap-5 px-5 py-20 sm:px-8 md:grid-cols-3">
            {[
              [FileText, "Capture your understanding", "Markdown notes stay yours. Autosave and revision checks protect what you wrote."],
              [CalendarClock, "Review on the right day", "Use FSRS or a transparent 1-day, 1-week, 1-month rhythm—calculated in your timezone."],
              [Sparkles, "Add AI only when useful", "AI notes appear in a separate pane, carry provenance, and can never overwrite personal notes."],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof FileText;
              return <article className="card p-6" key={title as string}><FeatureIcon className="text-[var(--accent)]" size={22} /><h2 className="mt-5 text-xl font-bold">{title as string}</h2><p className="mt-2 text-[var(--muted)]">{copy as string}</p></article>;
            })}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8">
          <ShieldCheck className="mx-auto text-[var(--accent)]" size={34} />
          <h2 className="mt-5 text-balance text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Built as a real portfolio system, not a disposable tracker.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">Row-level security, conflict-safe notes, provider audit logs, encrypted exports, accessible interactions, and a public demo isolated from private data.</p>
        </section>
      </main>
      <footer className="border-t border-[var(--border)] px-5 py-8 text-center text-sm text-[var(--muted)]">Roadmap Recall · A focused place to keep learning</footer>
    </div>
  );
}
