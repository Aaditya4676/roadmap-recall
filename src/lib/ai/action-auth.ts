import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { env } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/admin";

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function requireAiAction(request: NextRequest) {
  const db = createAdminSupabase();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const fingerprint = createHash("sha256").update(token || "missing").digest("hex").slice(0, 20);
  const route = new URL(request.url).pathname;
  if (!env.AI_ACTION_TOKEN || !token || !equal(token, env.AI_ACTION_TOKEN)) {
    await db.from("ai_api_requests").insert({ token_fingerprint: fingerprint, route, succeeded: false, status_code: 401 });
    throw new HttpError(401, "Invalid AI Action credential.", "invalid_ai_token");
  }
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from("ai_api_requests").select("id", { count: "exact", head: true }).eq("token_fingerprint", fingerprint).gte("requested_at", since);
  if ((count ?? 0) >= 30) {
    await db.from("ai_api_requests").insert({ token_fingerprint: fingerprint, route, succeeded: false, status_code: 429 });
    throw new HttpError(429, "AI Action rate limit exceeded. Retry in one minute.", "rate_limited");
  }
  const { data: owner, error } = await db.from("profiles").select("id, ai_action_share_personal_notes").eq("email", env.OWNER_EMAIL).maybeSingle();
  if (error || !owner) throw new HttpError(503, "Owner profile is not configured.", "owner_not_configured");
  return { db, owner, fingerprint, route };
}

export async function logAiAction(db: any, fingerprint: string, route: string, status: number) {
  await db.from("ai_api_requests").insert({ token_fingerprint: fingerprint, route, succeeded: status < 400, status_code: status });
}

export function encodeCursor(offset: number): string { return Buffer.from(String(offset)).toString("base64url"); }
export function decodeCursor(cursor: string | null): number {
  if (!cursor) return 0;
  const value = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  if (!Number.isSafeInteger(value) || value < 0) throw new HttpError(400, "Invalid cursor.", "invalid_cursor");
  return value;
}
