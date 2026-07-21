import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProfileIdentity {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

function profileName(user: ProfileIdentity): string {
  const metadataName = user.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  return user.email?.split("@")[0] || "Owner";
}

/**
 * Auth users can predate the profile trigger when a project is bootstrapped.
 * Repair that one-time setup gap without ever overwriting profile preferences.
 */
export async function ensureUserProfile(db: SupabaseClient, user: ProfileIdentity): Promise<void> {
  const { data, error } = await db.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (data) return;

  const { error: insertError } = await db.from("profiles").insert({
    id: user.id,
    email: user.email ?? "",
    display_name: profileName(user),
  });

  // A concurrent request may have created the same profile after our read.
  if (insertError && insertError.code !== "23505") throw insertError;
}
