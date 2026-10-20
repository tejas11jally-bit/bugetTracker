import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { fromMinor, decimalsOf } from "@/lib/money";
import { formatDate } from "@/lib/dates";

// CSV export of all transactions (F17). Accepts the same filters as the transactions list.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const and: Prisma.TransactionWhereInput[] = [{ split: false }];
  if (sp.get("from")) and.push({ date: { gte: sp.get("from")! } });
  if (sp.get("to")) and.push({ date: { lte: sp.get("to")! } });
  if (Number(sp.get("account"))) and.push({ OR: [{ accountId: Number(sp.get("account")) }, { transferAccountId: Number(sp.get("account")) }] });
  if (sp.get("q")) and.push({ OR: [{ payee: { contains: sp.get("q")! } }, { note: { contains: sp.get("q")! } }] });
  const rows = await prisma.transaction.findMany({
    where: { AND: and },
    include: { account: true, transferAccount: true, category: true, parent: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  const out: (string | number | null)[][] = [["id", "date", "type", "account", "to_account", "category", "payee", "amount", "currency", "fx_rate", "amount_aed", "note", "tags", "status", "source", "card", "split_of"]];
  for (const r of rows) {
    out.push([
      r.id,
      formatDate(r.date),
      r.type,
      r.account.name,
      r.transferAccount?.name ?? "",
      r.category?.name ?? "",
      r.payee,
      fromMinor(r.amountOriginal, r.currency).toFixed(decimalsOf(r.currency)),
      r.currency,
      r.fxRate,
      (r.amountBase / 100).toFixed(2),
      r.note,
      r.tags,
      r.status,
      r.source,
      r.cardLabel ?? "",
      r.parentId ?? "",
    ]);
  }
  return new Response(toCsv(out), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ledgerly-transactions.csv"` },
  });
}
