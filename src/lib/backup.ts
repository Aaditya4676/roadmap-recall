import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { selectAllByOwner } from "@/lib/supabase/pagination";

export const BACKUP_SCHEMA_VERSION = 1;
export const backupTables = [
  "roadmap_imports", "roadmap_sections", "roadmap_items", "study_topics",
  "personal_notes", "review_states", "review_events", "scheduler_change_events",
  "ai_notes", "ai_note_versions", "ai_generation_attempts", "reminder_deliveries",
] as const;

export const backupSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string().datetime(),
  owner: z.object({
    timeZone: z.string(), defaultScheduler: z.enum(["fsrs", "fixed"]),
    defaultKeepWarmDays: z.union([z.literal(14), z.literal(30), z.literal(60), z.null()]),
    reminderEnabled: z.boolean(), aiActionSharePersonalNotes: z.boolean(),
  }),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export async function buildBackup(db: SupabaseClient, ownerId: string) {
  const { data: profile, error: profileError } = await db.from("profiles").select("time_zone, default_scheduler, default_keep_warm_days, reminder_enabled, ai_action_share_personal_notes").eq("id", ownerId).single();
  if (profileError) throw profileError;
  const entries = await Promise.all(backupTables.map(async (table) => {
    const data = await selectAllByOwner(db, table, ownerId);
    return [table, data] as const;
  }));
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION as 1,
    exportedAt: new Date().toISOString(),
    owner: { timeZone: profile.time_zone, defaultScheduler: profile.default_scheduler, defaultKeepWarmDays: profile.default_keep_warm_days, reminderEnabled: profile.reminder_enabled, aiActionSharePersonalNotes: profile.ai_action_share_personal_notes },
    data: Object.fromEntries(entries),
  };
}

export interface EncryptedBackupEnvelope {
  format: "roadmap-recall/aes-256-gcm+gzip";
  schemaVersion: 1;
  keyId: string;
  algorithm: "AES-256-GCM";
  iv: string;
  authTag: string;
  ciphertext: string;
  plaintextSha256: string;
  createdAt: string;
}

export function decodeBackupKey(base64: string): Buffer {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function encryptBackup(payload: unknown, key: Buffer, keyId: string): EncryptedBackupEnvelope {
  if (key.length !== 32) throw new Error("AES-256-GCM requires a 32-byte key.");
  const plaintext = Buffer.from(JSON.stringify(payload));
  const compressed = gzipSync(plaintext, { level: 9 });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return {
    format: "roadmap-recall/aes-256-gcm+gzip",
    schemaVersion: 1,
    keyId,
    algorithm: "AES-256-GCM",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    plaintextSha256: createHash("sha256").update(plaintext).digest("hex"),
    createdAt: new Date().toISOString(),
  };
}

export function decryptBackup(envelope: EncryptedBackupEnvelope, key: Buffer): unknown {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  const compressed = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
  const plaintext = gunzipSync(compressed);
  const digest = createHash("sha256").update(plaintext).digest("hex");
  if (digest !== envelope.plaintextSha256) throw new Error("Backup checksum mismatch.");
  return JSON.parse(plaintext.toString("utf8"));
}

export function validateBackup(input: unknown) {
  const backup = backupSchema.parse(input);
  const counts = Object.fromEntries(Object.entries(backup.data).map(([table, rows]) => [table, rows.length]));
  const warnings: string[] = [];
  for (const required of ["study_topics", "personal_notes", "review_states"]) {
    if (!(required in backup.data)) warnings.push(`Missing optional/expected table: ${required}`);
  }
  return { backup, counts, warnings };
}
