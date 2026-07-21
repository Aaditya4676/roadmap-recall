import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup } from "@/lib/backup";

describe("encrypted backups", () => {
  it("round-trips compressed JSON and detects a wrong key", () => {
    const key = randomBytes(32);
    const payload = { schemaVersion: 1, notes: ["closures", "rendering"] };
    const envelope = encryptBackup(payload, key, "test-key");
    expect(envelope.ciphertext).not.toContain("closures");
    expect(decryptBackup(envelope, key)).toEqual(payload);
    expect(() => decryptBackup(envelope, randomBytes(32))).toThrow();
  });
});
