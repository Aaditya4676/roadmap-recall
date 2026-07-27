import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/env";
import { ensureUserProfile } from "@/lib/supabase/profile";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!hasSupabaseConfig() || !code) return NextResponse.redirect(new URL("/login?error=invalid_link", url));
  const db = await createServerSupabase();
  const { data, error } = await db.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=expired_link", url));
  try {
    await ensureUserProfile(db, data.user);
  } catch (profileError) {
    console.error("[roadmap-recall profile bootstrap error]", profileError);
    await db.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=profile_setup", url));
  }
  return NextResponse.redirect(new URL("/app/today", url));
}
