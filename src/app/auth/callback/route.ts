import { NextResponse } from "next/server";
import { env, hasSupabaseConfig } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!hasSupabaseConfig() || !code) return NextResponse.redirect(new URL("/login?error=invalid_link", url));
  const db = await createServerSupabase();
  const { data, error } = await db.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=expired_link", url));
  if (env.OWNER_EMAIL && data.user.email?.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) {
    await db.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=owner_only", url));
  }
  return NextResponse.redirect(new URL("/app/today", url));
}
