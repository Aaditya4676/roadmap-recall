import { PageHeading } from "@/components/page-heading";
import { ImportDryRun } from "@/components/import-dry-run";
import { AccountPanel, SettingsForm } from "@/components/settings-form";
import { AI_RECALL_DAILY_LIMIT, isConfiguredOwner } from "@/lib/ai/recall-judge-quota";
import { ensureUserProfile } from "@/lib/supabase/profile";
import { createServerSupabase, getAuthenticatedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = await createServerSupabase();
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required.");
  await ensureUserProfile(db, user);
  const [profileResult, usageResult] = await Promise.all([
    db.from("profiles").select("display_name, time_zone, default_scheduler, default_keep_warm_days, reminder_enabled, ai_action_share_personal_notes").eq("id", user.id).single(),
    db.rpc("get_ai_recall_judgment_usage"),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (usageResult.error) throw usageResult.error;
  const { display_name, ...settings } = profileResult.data;
  const authProvider = typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email";
  const account = {
    id: user.id,
    email: user.email ?? "No email available",
    displayName: display_name || user.email?.split("@")[0] || "Account",
    authProvider,
    isOwner: isConfiguredOwner(user.email),
    aiJudgmentsUsedToday: Number(usageResult.data ?? 0),
    aiJudgmentDailyLimit: AI_RECALL_DAILY_LIMIT,
  };
  return <><PageHeading eyebrow="Preferences and data" title="Simple defaults, explicit boundaries" description="Scheduler changes affect new topics unless you deliberately replay existing history." /><AccountPanel account={account} /><SettingsForm initial={settings} /><div className="mt-6"><ImportDryRun /></div></>;
}
