import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { env, hasSupabaseConfig } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getAuthenticatedUser();
  if (user && (!env.OWNER_EMAIL || user.email?.toLowerCase() === env.OWNER_EMAIL.toLowerCase())) redirect("/app/today");

  return (
    <div className="min-h-screen">
      <header className="public-chrome liquid-chrome" data-liquid>
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/"><Logo /></Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 pb-16 pt-18 sm:pt-24">
        <div className="liquid-dialog rounded-[12px] p-6 sm:p-8" data-liquid>
          <p className="eyebrow">Private workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mb-7 mt-2 text-[var(--muted)]">One owner, one calm place for notes and revision.</p>
          <LoginForm configured={hasSupabaseConfig()} />
        </div>
        <p className="mt-5 text-center text-sm text-[var(--muted)]">Want to look around first? <Link className="font-bold text-[var(--accent)]" href="/demo">Open the local demo</Link>.</p>
      </main>
    </div>
  );
}
