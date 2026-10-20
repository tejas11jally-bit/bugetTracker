// Runs each tests/*.test.ts against its own fresh SQLite database (no test framework needed).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
let failed = 0;
for (const file of readdirSync(here).filter((f) => f.endsWith(".test.ts")).sort()) {
  const dir = mkdtempSync(path.join(tmpdir(), "ledgerly-test-"));
  const env = { ...process.env, DATA_DIR: dir, BACKUP_DIR: path.join(dir, "backups"), DATABASE_URL: `file:${path.join(dir, "ledgerly.db")}`, LEDGERLY_SCHEDULER: "off" };
  spawnSync(process.execPath, [path.join(root, "scripts/migrate.mjs")], { env, stdio: "ignore" });
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--import", path.join(here, "register.mjs"), path.join(here, file)], { env, stdio: "inherit", cwd: root });
  if (r.status !== 0) {
    failed++;
    console.error(`✗ ${file}`);
  }
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
