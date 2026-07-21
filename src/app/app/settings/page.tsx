import { PageHeading } from "@/components/page-heading";
import { ImportDryRun } from "@/components/import-dry-run";
import { SettingsForm } from "@/components/settings-form";
import { ensureUserProfile } from "@/lib/supabase/profile";
import { createServerSupabase, getAuthenticatedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = await createServerSupabase();
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required.");
  await ensureUserProfile(db, user);
  const { data, error } = await db.from("profiles").select("time_zone, default_scheduler, default_keep_warm_days, reminder_enabled, ai_action_share_personal_notes").eq("id", user.id).single();
  if (error) throw error;
  return <><PageHeading eyebrow="Preferences and data" title="Simple defaults, explicit boundaries" description="Scheduler changes affect new topics unless you deliberately replay existing history." /><SettingsForm initial={data} /><div className="mt-6"><ImportDryRun /></div></>;
}
