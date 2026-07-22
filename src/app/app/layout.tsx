import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { env, hasSupabaseConfig } from "@/lib/env";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseConfig()) {
    return <AppShell><div className="liquid-panel mx-auto max-w-2xl rounded-[12px] p-7" data-liquid><p className="eyebrow">Setup required</p><h1 className="mt-2 text-3xl font-bold">Connect the private workspace</h1><p className="mt-3 text-[var(--muted)]">Supabase credentials are intentionally absent, so private routes are fail-closed. Follow the setup steps in the project README; meanwhile, <a className="font-bold text-[var(--accent)]" href="/demo">the local demo is ready</a>.</p></div></AppShell>;
  }
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (env.OWNER_EMAIL && user.email?.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) redirect("/login?error=owner_only");
  return <AppShell>{children}</AppShell>;
}
