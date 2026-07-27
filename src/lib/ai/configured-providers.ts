import "server-only";

import type { ProviderName } from "@/lib/ai/provider";
import { env } from "@/lib/env";

export function configuredRecallProviders(): ProviderName[] {
  const providers: ProviderName[] = [];
  if (env.GEMINI_API_KEY) providers.push("gemini");
  if (env.ZAI_API_KEY) providers.push("zai");
  return providers;
}
