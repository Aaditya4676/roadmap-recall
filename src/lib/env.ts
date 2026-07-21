import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OWNER_EMAIL: z.string().email().optional().or(z.literal("")),
  APP_URL: optionalUrl,
  APP_TIME_ZONE: z.string().default("Asia/Kolkata"),
  AI_ACTION_TOKEN: z.string().min(32).optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  ZAI_API_KEY: z.string().optional(),
  ZAI_MODEL: z.string().default("glm-4.5-flash"),
  ZAI_API_BASE: z.string().url().default("https://api.z.ai/api/paas/v4"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  CRON_SECRET: z.string().min(20).optional(),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  BACKUP_KEY_ID: z.string().default("primary-2026"),
});

export const env = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OWNER_EMAIL: process.env.OWNER_EMAIL,
  APP_URL: process.env.APP_URL,
  APP_TIME_ZONE: process.env.APP_TIME_ZONE,
  AI_ACTION_TOKEN: process.env.AI_ACTION_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  ZAI_API_KEY: process.env.ZAI_API_KEY,
  ZAI_MODEL: process.env.ZAI_MODEL,
  ZAI_API_BASE: process.env.ZAI_API_BASE,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
  CRON_SECRET: process.env.CRON_SECRET,
  BACKUP_ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY,
  BACKUP_KEY_ID: process.env.BACKUP_KEY_ID,
});

export function hasSupabaseConfig(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasServiceConfig(): boolean {
  return hasSupabaseConfig() && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
}
