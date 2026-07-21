import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { env } from "@/lib/env";

export function requireCron(request: NextRequest) {
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = env.CRON_SECRET ?? "";
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "Invalid cron credential.", "invalid_cron_token");
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}
