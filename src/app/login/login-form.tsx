"use client";

import { Mail, Send } from "lucide-react";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function LoginForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setStatus("sending");
    try {
      const supabase = createBrowserSupabase();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: false,
        },
      });
      if (authError) throw authError;
      setStatus("sent");
    } catch (cause) {
      setStatus("idle"); setError(cause instanceof Error ? cause.message : "Could not send the link.");
    }
  }

  if (!configured) return <div className="rounded-lg border border-[var(--border)] bg-[var(--subtle)] p-5 text-sm"><p className="font-bold">Cloud setup is not connected yet.</p><p className="mt-2 text-[var(--muted)]">Copy <code>.env.example</code> to <code>.env.local</code>, add the Supabase URL and anon key, apply the SQL migrations, then restart the dev server. The public demo works now.</p></div>;
  if (status === "sent") return <div className="py-4 text-center"><Mail className="mx-auto text-[var(--accent)]" size={24} /><h2 className="mt-4 text-xl font-bold">Check your inbox</h2><p className="mt-2 text-sm text-[var(--muted)]">The magic link expires shortly. You can close this tab after opening it.</p></div>;
  return <form onSubmit={submit} className="grid gap-5"><label className="grid gap-1.5 font-semibold">Owner email<input type="email" autoComplete="email" required className="field font-normal" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>{error && <p role="alert" className="rounded-xl bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}<button className="button-primary" disabled={status === "sending"}><Send size={17} /> {status === "sending" ? "Sending…" : "Email me a magic link"}</button></form>;
}
