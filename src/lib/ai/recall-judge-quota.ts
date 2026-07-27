import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ProviderName } from "@/lib/ai/provider";
import { HttpError } from "@/lib/auth";
import { env } from "@/lib/env";

export const AI_RECALL_DAILY_LIMIT = 5;

export function isConfiguredOwner(email?: string | null): boolean {
  return Boolean(env.OWNER_EMAIL && email && email.toLowerCase() === env.OWNER_EMAIL.toLowerCase());
}

function providerModel(provider: ProviderName): string {
  return provider === "gemini" ? env.GEMINI_MODEL : env.ZAI_MODEL;
}

export async function withRecallJudgeQuota<T>({
  db,
  user,
  topicId,
  reviewEventId = null,
  provider,
  operation,
}: {
  db: SupabaseClient;
  user: User;
  topicId: string;
  reviewEventId?: string | null;
  provider: ProviderName;
  operation: () => Promise<T>;
}): Promise<T> {
  let attemptId: string | null = null;
  if (!isConfiguredOwner(user.email)) {
    const { data, error } = await db.rpc("claim_ai_recall_judgment", {
      p_topic_id: topicId,
      p_review_event_id: reviewEventId,
      p_provider: provider,
      p_model: providerModel(provider),
    });
    if (error?.code === "P0001") {
      throw new HttpError(429, `You have used ${AI_RECALL_DAILY_LIMIT} AI review judgments in the last 24 hours. Manual rating is still available.`, "ai_judgment_limit");
    }
    if (error) throw error;
    attemptId = data as string;
  }

  try {
    const result = await operation();
    if (attemptId) {
      const { error } = await db.rpc("finish_ai_recall_judgment", {
        p_attempt_id: attemptId,
        p_status: "succeeded",
        p_error_code: null,
      });
      if (error) console.error("[recall judge quota finish error]", error);
    }
    return result;
  } catch (error) {
    if (attemptId) {
      const { error: finishError } = await db.rpc("finish_ai_recall_judgment", {
        p_attempt_id: attemptId,
        p_status: "failed",
        p_error_code: (error as { code?: string })?.code ?? "judge_failed",
      });
      if (finishError) console.error("[recall judge quota finish error]", finishError);
    }
    throw error;
  }
}
