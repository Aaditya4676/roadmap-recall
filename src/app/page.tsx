import { ArrowRight, Brain, CalendarClock, Check, FileText, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="public-chrome liquid-chrome sticky top-0 z-40" data-liquid>
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden sm:block"><Link href="/login" className="button-ghost">Sign in</Link></span>
            <Link href="/demo" className="button-secondary" data-liquid>Try the demo</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-22 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.04fr_.96fr] lg:gap-18 lg:pb-28 lg:pt-24">
          <div>
            <p className="context-label mb-4">A quieter way to keep learning</p>
            <h1 className="text-balance max-w-3xl text-5xl font-bold leading-[1.06] tracking-[-0.045em] sm:text-6xl">
              Remember what you learn, without managing a spreadsheet.
            </h1>
            <p className="mt-7 max-w-2xl text-balance text-lg leading-relaxed text-[var(--muted)] sm:text-xl">
              Capture a topic in seconds, recall it at the right time, and keep your own notes separate from optional AI explanations.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/demo" className="button-primary !min-h-12 !px-5" data-liquid>Open local demo <ArrowRight size={18} /></Link>
              <Link href="/login" className="button-secondary !min-h-12 !px-5" data-liquid>Set up my space</Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><Check size={16} className="text-[var(--accent)]" /> No streak pressure</span>
              <span className="inline-flex items-center gap-1.5"><Check size={16} className="text-[var(--accent)]" /> Private by default</span>
              <span className="inline-flex items-center gap-1.5"><Check size={16} className="text-[var(--accent)]" /> Works with any subject</span>
            </div>
          </div>

          <div className="landing-stage mx-auto w-full max-w-xl" aria-label="Preview of a daily review queue">
            <div aria-hidden className="absolute inset-x-7 bottom-6 grid gap-3 opacity-55">
              {["Memory systems", "Database indexing", "French vocabulary", "Music theory"].map((topic, index) => (
                <div className="landing-memory-row flex items-center justify-between px-4 py-3" key={topic}>
                  <span className="font-medium">{topic}</span><span className="text-xs text-[var(--muted)]">{index + 2}d</span>
                </div>
              ))}
            </div>
            <div className="landing-preview liquid-panel overflow-hidden p-5 sm:p-7" data-liquid>
              <div className="flex items-start justify-between gap-4">
                <div><p className="context-label">Monday, 20 July</p><h2 className="mt-1 text-2xl font-bold">Three ideas to revisit</h2></div>
                <span className="rounded-md border border-[var(--border)] px-2.5 py-1 text-sm font-semibold text-[var(--muted)]">~6 min</span>
              </div>
              <div className="mt-6 grid gap-3">
                {["Compound interest", "Active recall", "Photosynthesis"].map((topic, index) => (
                  <div key={topic} className="landing-memory-row flex items-center gap-3 p-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--subtle)] text-sm font-bold">{index + 1}</span>
                    <div className="min-w-0"><p className="truncate font-semibold">{topic}</p><p className="text-xs text-[var(--muted)]">{index === 0 ? "Due today" : `${index + 1} days overdue`}</p></div>
                  </div>
                ))}
              </div>
              <Link href="/demo" className="button-primary mt-6 w-full" data-liquid><Brain size={18} /> Start a calm review</Link>
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--border)] bg-[color:var(--surface)]/48">
          <div className="mx-auto grid max-w-7xl px-5 py-18 sm:px-8 md:grid-cols-3 md:divide-x md:divide-[var(--border)]">
            {[
              [FileText, "Capture your understanding", "Markdown notes stay yours. Autosave and revision checks protect what you wrote."],
              [CalendarClock, "Review on the right day", "Use FSRS or a transparent 1-day, 1-week, 1-month rhythm—calculated in your timezone."],
              [Sparkles, "Add AI only when useful", "AI notes appear in a separate pane, carry provenance, and can never overwrite personal notes."],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof FileText;
              return <article className="border-b border-[var(--border)] py-7 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0" key={title as string}><FeatureIcon className="text-[var(--accent)]" size={22} /><h2 className="mt-5 text-xl font-bold">{title as string}</h2><p className="mt-2 max-w-sm text-[var(--muted)]">{copy as string}</p></article>;
            })}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-22 sm:px-8 sm:py-26">
          <div className="liquid-panel grid items-center gap-7 rounded-[12px] p-6 sm:p-9 md:grid-cols-[auto_1fr]" data-liquid>
            <ShieldCheck className="text-[var(--accent)]" size={38} />
            <div>
              <h2 className="text-balance text-3xl font-bold tracking-[-0.035em]">A serious system behind a calm interface.</h2>
              <p className="mt-3 max-w-3xl text-lg text-[var(--muted)]">Row-level security, conflict-safe notes, provider audit logs, encrypted exports, accessible interactions, and a public demo isolated from private data.</p>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[var(--border)] px-5 py-8 text-center text-sm text-[var(--muted)]">Roadmap Recall · A focused place to keep learning</footer>
    </div>
  );
}
