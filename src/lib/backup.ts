import fs from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { BACKUP_DIR } from "./paths";
import { today } from "./dates";
import { setState } from "./push";

const KEEP_DAYS = 30;

/** Nightly SQLite copy to the mounted backup folder, keeping 30 days (PRD "Non-functional requirements"). */
export async function runBackup(): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `ledgerly-${today()}.db`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  // VACUUM INTO writes a consistent snapshot while the app keeps running.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^ledgerly-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .reverse();
  for (const old of backups.slice(KEEP_DAYS)) fs.unlinkSync(path.join(BACKUP_DIR, old));
  await setState("last_backup", new Date().toISOString());
  return file;
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse()
    .map((f) => ({ name: f, size: fs.statSync(path.join(BACKUP_DIR, f)).size }));
}
