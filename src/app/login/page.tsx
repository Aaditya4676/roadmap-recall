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
  return <div className="min-h-screen px-5 py-6"><header className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/"><Logo /></Link><ThemeToggle /></header><main className="mx-auto mt-20 max-w-md"><div className="card p-6 sm:p-8"><p className="eyebrow">Private workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h1><p className="mb-7 mt-2 text-[var(--muted)]">One owner, one calm place for notes and revision.</p><LoginForm configured={hasSupabaseConfig()} /></div><p className="mt-5 text-center text-sm text-[var(--muted)]">Want to look around first? <Link className="font-bold text-[var(--accent)]" href="/demo">Open the local demo</Link>.</p></main></div>;
}
