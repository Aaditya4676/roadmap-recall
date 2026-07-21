import { readFile } from "node:fs/promises";
import path from "node:path";
import { backupSchema, decodeBackupKey, decryptBackup, type EncryptedBackupEnvelope } from "../src/lib/backup";

async function main() {
  const file = process.argv[2];
  const encodedKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (!file || !encodedKey) throw new Error("Usage: BACKUP_ENCRYPTION_KEY=... npm run backup:inspect -- path/to/backup.json.enc");
  const envelope = JSON.parse(await readFile(path.resolve(file), "utf8")) as EncryptedBackupEnvelope;
  const backup = backupSchema.parse(decryptBackup(envelope, decodeBackupKey(encodedKey)));
  console.log(JSON.stringify({ schemaVersion: backup.schemaVersion, exportedAt: backup.exportedAt, owner: backup.owner, counts: Object.fromEntries(Object.entries(backup.data).map(([table, rows]) => [table, rows.length])) }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
