import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "request_error") {
    super(message);
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function requireOwnerRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (env.AI_ACTION_TOKEN && safeEqual(token, env.AI_ACTION_TOKEN)) {
      throw new HttpError(403, "AI credentials are not accepted by owner routes.", "credential_boundary");
    }
    throw new HttpError(403, "Owner routes use the signed-in browser session, not bearer credentials.", "credential_boundary");
  }

  const db = await createServerSupabase();
  // Mutation routes deliberately fetch the current Auth user so revoked or
  // changed accounts are observed immediately. Page navigation uses the
  // faster, cryptographically verified JWT claims path instead.
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sign in required.", "unauthorized");
  if (env.OWNER_EMAIL && data.user.email?.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) {
    throw new HttpError(403, "This deployment is restricted to its owner.", "owner_only");
  }
  return { db, user: data.user };
}

export function errorResponse(error: unknown) {
  const status = error instanceof HttpError ? error.status : 500;
  if (status === 500) console.error("[roadmap-recall request error]", error);
  const message = error instanceof HttpError ? error.message : "The request could not be completed.";
  const code = error instanceof HttpError ? error.code : "internal_error";
  return Response.json({ error: { code, message } }, { status });
}
