// Applies Prisma migrations to the SQLite file in DATA_DIR (./data in dev, /app/data in Docker).
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });
const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? `file:${path.join(dataDir, "ledgerly.db")}` };
// PRISMA_CLI is set in the Docker image, where the CLI lives outside the app bundle.
const prismaCli = process.env.PRISMA_CLI ?? createRequire(import.meta.url).resolve("prisma/build/index.js");
const r = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], { stdio: "inherit", env });
process.exit(r.status ?? 1);
