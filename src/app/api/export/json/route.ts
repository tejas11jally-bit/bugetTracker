import { exportAll } from "@/lib/backup-json";

export async function GET() {
  const data = await exportAll();
  return new Response(JSON.stringify(data, null, 1), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="ledgerly-${data.exportedAt.slice(0, 10)}.json"` },
  });
}
