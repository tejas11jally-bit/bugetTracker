import fs from "node:fs";
import path from "node:path";
import { BACKUP_DIR } from "@/lib/paths";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = path.basename((await params).name);
  const file = path.join(BACKUP_DIR, name);
  if (!/^ledgerly-[\w-]+\.db$/.test(name) || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), { headers: { "content-type": "application/vnd.sqlite3", "content-disposition": `attachment; filename="${name}"` } });
}
