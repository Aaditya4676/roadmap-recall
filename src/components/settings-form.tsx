"use client";

import { Download, LogOut, Save, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

interface Settings {
  time_zone: string;
  default_scheduler: "fsrs" | "fixed";
  default_keep_warm_days: 14 | 30 | 60 | null;
  reminder_enabled: boolean;
  ai_action_share_personal_notes: boolean;
}

export interface AccountSummary {
  id: string;
  email: string;
  displayName: string;
  authProvider: string;
  isOwner: boolean;
  aiJudgmentsUsedToday: number;
  aiJudgmentDailyLimit: number;
}

export function AccountPanel({ account }: { account: AccountSummary }) {
  const remaining = Math.max(0, account.aiJudgmentDailyLimit - account.aiJudgmentsUsedToday);
  return (
    <section className="content-surface mb-6 p-5 sm:p-6" aria-labelledby="account-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {account.isOwner ? <ShieldCheck className="mt-0.5 shrink-0 text-[var(--accent)]" size={21} /> : <UserRound className="mt-0.5 shrink-0 text-[var(--muted)]" size={21} />}
          <div className="min-w-0">
            <h2 id="account-heading" className="font-bold">{account.displayName}</h2>
            <p className="break-all text-sm text-[var(--muted)]">{account.email}</p>
          </div>
        </div>
        <span className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-semibold">
          {account.isOwner ? "Owner account" : "Member account"}
        </span>
      </div>
      <dl className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 text-sm sm:grid-cols-3">
        <div><dt className="text-[var(--muted)]">Signed in with</dt><dd className="mt-0.5 font-medium capitalize">{account.authProvider}</dd></div>
        <div><dt className="text-[var(--muted)]">User ID</dt><dd className="mt-0.5 break-all font-mono text-xs">{account.id}</dd></div>
        <div><dt className="text-[var(--muted)]">AI review judgments</dt><dd className="mt-0.5 font-medium">{account.isOwner ? "Unlimited for owner" : `${remaining} of ${account.aiJudgmentDailyLimit} remaining in 24 hours`}</dd></div>
      </dl>
    </section>
  );
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [migrate, setMigrate] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setStatus("");
    const response = await fetch("/api/app/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ timeZone: settings.time_zone, defaultScheduler: settings.default_scheduler, defaultKeepWarmDays: settings.default_keep_warm_days, reminderEnabled: settings.reminder_enabled, aiActionSharePersonalNotes: settings.ai_action_share_personal_notes, migrateExisting: migrate }) });
    const data = await response.json();
    setStatus(response.ok ? "Settings saved." : data.error?.message ?? "Could not save settings."); setSaving(false); if (response.ok) router.refresh();
  }
  async function signOut() { await createBrowserSupabase().auth.signOut(); router.push("/login"); router.refresh(); }
  return <div className="grid gap-6"><form className="content-surface divide-y divide-[var(--border)]" onSubmit={save}><Setting title="Owner timezone" copy="Review dates use this calendar day. Use an IANA name such as Asia/Kolkata."><input className="field max-w-xs" value={settings.time_zone} onChange={(e) => setSettings({ ...settings, time_zone: e.target.value })} /></Setting><Setting title="Default scheduler" copy="Applies to newly activated topics. FSRS adapts to ratings; Fixed is transparent and predictable."><select className="field max-w-xs" value={settings.default_scheduler} onChange={(e) => setSettings({ ...settings, default_scheduler: e.target.value as Settings["default_scheduler"] })}><option value="fsrs">FSRS · 90% retention</option><option value="fixed">Fixed · 1d, 7d, 30d</option></select><label className="mt-3 flex max-w-md items-start gap-2 text-sm text-[var(--muted)]"><input className="mt-1" type="checkbox" checked={migrate} onChange={(e) => setMigrate(e.target.checked)} /> Explicitly migrate existing topics by replaying their review history. Easy maps to Good when moving to Fixed.</label></Setting><Setting title="Keep-warm interval" copy="After the initial reviews, continue revisiting important topics at this interval."><select className="field max-w-xs" value={settings.default_keep_warm_days ?? ""} onChange={(e) => setSettings({ ...settings, default_keep_warm_days: e.target.value ? Number(e.target.value) as 14 | 30 | 60 : null })}><option value="">No override (30 days for Fixed)</option><option value="14">Every 2 weeks</option><option value="30">Every month</option><option value="60">Every 2 months</option></select></Setting><Setting title="Daily reminder" copy="Send one email only on days with due topics. The email contains titles and counts, never note contents."><input type="checkbox" checked={settings.reminder_enabled} onChange={(e) => setSettings({ ...settings, reminder_enabled: e.target.checked })} /></Setting><Setting title="Custom GPT context consent" copy="When enabled, the separate AI Action may read personal notes for one requested topic. It can never write them."><input type="checkbox" checked={settings.ai_action_share_personal_notes} onChange={(e) => setSettings({ ...settings, ai_action_share_personal_notes: e.target.checked })} /></Setting><div className="flex flex-wrap items-center justify-end gap-3 p-5 sm:p-6">{status && <p role="status" className="mr-auto text-sm text-[var(--muted)]">{status}</p>}<button className="button-primary" data-liquid disabled={saving}><Save size={17} /> {saving ? "Saving…" : "Save settings"}</button></div></form><section className="liquid-panel rounded-[12px] p-5 sm:p-6" data-liquid><h2 className="text-xl font-bold">Portable backups</h2><p className="mt-1 text-sm text-[var(--muted)]">JSON is restorable; Markdown ZIP is human-readable. Neither export sends data to an AI provider.</p><div className="mt-4 flex flex-wrap gap-2"><a className="button-secondary" data-liquid href="/api/app/export/json"><Download size={17} /> Versioned JSON</a><a className="button-secondary" data-liquid href="/api/app/export/markdown"><Download size={17} /> Markdown ZIP</a></div></section><section className="content-surface flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"><div><h2 className="font-bold">Session</h2><p className="text-sm text-[var(--muted)]">Sign out on this browser.</p></div><button className="button-secondary" data-liquid onClick={signOut}><LogOut size={17} /> Sign out</button></section></div>;
}

function Setting({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) { return <div className="grid gap-4 p-5 sm:grid-cols-[1fr_minmax(220px,340px)] sm:items-start sm:p-6"><div><h2 className="font-bold">{title}</h2><p className="mt-1 max-w-xl text-sm text-[var(--muted)]">{copy}</p></div><div>{children}</div></div>; }
