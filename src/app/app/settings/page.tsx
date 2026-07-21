import { PageHeading } from "@/components/page-heading";
import { ImportDryRun } from "@/components/import-dry-run";
import { SettingsForm } from "@/components/settings-form";
import { ensureUserProfile } from "@/lib/supabase/profile";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = await createServerSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) throw authError ?? new Error("Authentication required.");
  await ensureUserProfile(db, auth.user);
  const { data, error } = await db.from("profiles").select("time_zone, default_scheduler, default_keep_warm_days, reminder_enabled, ai_action_share_personal_notes").eq("id", auth.user.id).single();
  if (error) throw error;
  return <><PageHeading eyebrow="Preferences and data" title="Simple defaults, explicit boundaries" description="Scheduler changes affect new topics unless you deliberately replay existing history." /><SettingsForm initial={data} /><div className="mt-6"><ImportDryRun /></div></>;
}
