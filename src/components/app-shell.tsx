"use client";

import { BarChart3, BookOpen, CalendarCheck2, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation = [
  { href: "/app/today", label: "Today", icon: CalendarCheck2 },
  { href: "/app/roadmap", label: "Roadmap", icon: BookOpen },
  { href: "/app/progress", label: "Progress", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, demo = false }: { children: React.ReactNode; demo?: boolean }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] border-r border-[var(--border)] bg-[color:var(--surface)] px-4 py-5 md:flex md:flex-col">
        <Link href={demo ? "/demo" : "/app/today"} className="px-2"><Logo /></Link>
        {demo && <span className="mx-2 mt-3 rounded-md border border-[var(--border)] px-2.5 py-1 text-center text-xs font-semibold text-[var(--muted)]">Local demo</span>}
        <nav className="mt-8 grid gap-1" aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = !demo && pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={demo ? `/demo?view=${label.toLowerCase()}` : href}
                className={`flex min-h-11 items-center gap-3 rounded-md px-3 font-semibold ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--subtle)] hover:text-[var(--foreground)]"}`}
              >
                <Icon size={19} /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] px-2 pt-4">
          <span className="text-xs text-[var(--muted)]">Private study space</span>
          <ThemeToggle />
        </div>
      </aside>

      <div className="min-w-0 md:col-start-2">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 md:hidden">
          <Logo />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-8 sm:px-8 md:pb-12 md:pt-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[var(--border)] bg-[var(--surface)] p-1.5 md:hidden" aria-label="Mobile navigation">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = !demo && pathname.startsWith(href);
          return (
            <Link key={href} href={demo ? `/demo?view=${label.toLowerCase()}` : href} className={`grid min-h-12 place-items-center rounded-md text-[0.68rem] font-bold ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)]"}`}>
              <Icon size={18} /><span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
