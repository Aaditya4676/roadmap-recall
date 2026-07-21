import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import { aiNoteDocumentSchema, type AiNoteInput } from "@/lib/ai/schema";

export type ProviderName = "gemini" | "zai";

export interface GenerationContext {
  title: string;
  breadcrumb: string;
  kind: string;
  personalMarkdown?: string;
}

function promptFor(context: GenerationContext, repair?: string): string {
  return `You create concise learning support for a self-directed learner.
Do not imitate the user's voice and do not overwrite or rewrite their note. Add a separate explanation.
Be technically precise, admit uncertainty, and prioritize durable mental models and active recall.

Topic: ${context.title}
Learning plan location: ${context.breadcrumb}
Kind: ${context.kind}
${context.personalMarkdown !== undefined ? `Personal note shared with explicit consent:\n---\n${context.personalMarkdown}\n---` : "No personal note was shared. Work only from the topic metadata."}

Return only JSON matching the supplied schema.${repair ? `\nThe previous JSON was invalid. Repair it for these validation errors: ${repair}` : ""}`;
}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds = 75_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try { return await operation(controller.signal); }
  finally { clearTimeout(timer); }
}

async function generateGemini(context: GenerationContext, repair?: string): Promise<{ text: string; model: string }> {
  if (!env.GEMINI_API_KEY) throw Object.assign(new Error("GEMINI_API_KEY is not configured."), { code: "provider_not_configured" });
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const response = await withTimeout((signal) => ai.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: promptFor(context, repair),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(aiNoteDocumentSchema),
      abortSignal: signal,
      temperature: 0.25,
    },
  }));
  if (!response.text) throw Object.assign(new Error("Gemini returned no text."), { code: "empty_response" });
  return { text: response.text, model: env.GEMINI_MODEL };
}

async function generateZai(context: GenerationContext, repair?: string): Promise<{ text: string; model: string }> {
  if (!env.ZAI_API_KEY) throw Object.assign(new Error("ZAI_API_KEY is not configured."), { code: "provider_not_configured" });
  return withTimeout(async (signal) => {
    const response = await fetch(`${env.ZAI_API_BASE.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal,
      headers: { authorization: `Bearer ${env.ZAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: env.ZAI_MODEL,
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return one valid JSON object only. Follow every requested field and bound." },
          { role: "user", content: `${promptFor(context, repair)}\nJSON Schema:\n${JSON.stringify(z.toJSONSchema(aiNoteDocumentSchema))}` },
        ],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      const error = Object.assign(new Error(`Z.AI request failed (${response.status}): ${body.slice(0, 400)}`), { code: response.status === 401 || response.status === 403 ? "provider_auth" : response.status === 429 ? "provider_quota" : "provider_error", noRetry: [401, 403, 429].includes(response.status) });
      throw error;
    }
    const body = await response.json();
    const text = body.choices?.[0]?.message?.content;
    if (!text) throw Object.assign(new Error("Z.AI returned no content."), { code: "empty_response" });
    return { text, model: env.ZAI_MODEL };
  });
}

export async function generateAiNote(provider: ProviderName, context: GenerationContext): Promise<{ document: AiNoteInput; model: string }> {
  const call = provider === "gemini" ? generateGemini : generateZai;
  let response = await call(context);
  try {
    return { document: aiNoteDocumentSchema.parse(JSON.parse(response.text)), model: response.model };
  } catch (firstError) {
    if ((firstError as any)?.noRetry) throw firstError;
    const validation = firstError instanceof z.ZodError ? firstError.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") : "Response was not valid JSON.";
    response = await call(context, validation.slice(0, 1_500));
    return { document: aiNoteDocumentSchema.parse(JSON.parse(response.text)), model: response.model };
  }
}
