import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { env, hasSupabaseConfig } from "@/lib/env";
import type { ProfileIdentity } from "@/lib/supabase/profile";

export async function createServerSupabase() {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured.");
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes sessions.
        }
      },
    },
  });
}

export const getAuthenticatedUser = cache(async (): Promise<ProfileIdentity | null> => {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return {
    id: data.claims.sub,
    email: data.claims.email,
    user_metadata: data.claims.user_metadata,
  };
});
