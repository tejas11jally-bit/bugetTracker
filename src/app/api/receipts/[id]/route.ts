import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { RECEIPT_DIR } from "@/lib/paths";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", pdf: "application/pdf" };

// Session-protected by middleware.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tx = await prisma.transaction.findUnique({ where: { id: Number((await params).id) } });
  if (!tx?.receiptPath) return new Response("Not found", { status: 404 });
  const file = path.join(RECEIPT_DIR, path.basename(tx.receiptPath));
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const ext = file.split(".").pop() ?? "";
  return new Response(fs.readFileSync(file), { headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "private, max-age=3600" } });
}
