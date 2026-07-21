import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env, hasServiceConfig } from "@/lib/env";

export function createAdminSupabase() {
  if (!hasServiceConfig()) throw new Error("Supabase service credentials are not configured.");
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
