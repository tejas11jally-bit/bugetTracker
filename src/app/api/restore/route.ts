import { restoreAll } from "@/lib/backup-json";
import { runBackup } from "@/lib/backup";

// Restore a full JSON backup. A SQLite snapshot is taken first, so a bad restore can be undone.
export async function POST(req: Request) {
  try {
    const data = await req.json();
    await runBackup();
    const result = await restoreAll(data);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
