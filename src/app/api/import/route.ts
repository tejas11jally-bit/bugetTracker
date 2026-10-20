import { prisma } from "@/lib/db";
import { createTransaction } from "@/lib/ledger";
import { matchByName } from "@/lib/quick-add";
import { isCurrency, toMinor } from "@/lib/money";
import { parseDateInput } from "@/lib/dates";

type Mapping = { date: number; amount: number; debit: number; credit: number; payee: number; category: number; account: number; currency: number; note: number; tags: number };
type Body = { rows: string[][]; mapping: Mapping; dateOrder: "dmy" | "ymd" | "mdy"; spendSign: "negative" | "positive"; accountId: number; skipDuplicates: boolean };

function parseDate(text: string, order: Body["dateOrder"]) {
  const t = text.trim();
  if (order === "mdy") {
    const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) return parseDateInput(`${m[2]}/${m[1]}/${m[3]}`);
  }
  return parseDateInput(t);
}

// CSV import with column mapping (F17). Header row is removed client-side.
export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const accounts = await prisma.account.findMany();
  const categories = await prisma.category.findMany();
  const fallback = accounts.find((a) => a.id === body.accountId) ?? accounts[0];
  if (!fallback) return Response.json({ error: "Create an account first" }, { status: 400 });
  const m = body.mapping;
  const col = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [n, row] of body.rows.entries()) {
    const date = parseDate(col(row, m.date), body.dateOrder);
    const account = (m.account >= 0 && matchByName(accounts, col(row, m.account))) || fallback;
    const cur = col(row, m.currency).toUpperCase();
    const currency = isCurrency(cur) ? cur : account.currency;
    let amount: number | null = null;
    if (m.amount >= 0) {
      const raw = col(row, m.amount).replace(/[^\d.,()-]/g, "");
      const neg = raw.startsWith("-") || raw.startsWith("(");
      const v = toMinor(raw.replace(/[()-]/g, ""), currency);
      if (v != null) amount = (neg ? -v : v) * (body.spendSign === "positive" ? -1 : 1);
    } else {
      const d = toMinor(col(row, m.debit).replace(/[^\d.,]/g, "") || "0", currency) ?? 0;
      const c = toMinor(col(row, m.credit).replace(/[^\d.,]/g, "") || "0", currency) ?? 0;
      amount = c - d;
    }
    if (!date || !amount) {
      errors.push(`Row ${n + 2}: ${!date ? "unreadable date" : "no amount"}`);
      continue;
    }
    const payee = col(row, m.payee);
    if (body.skipDuplicates) {
      const dup = await prisma.transaction.findFirst({ where: { date, accountId: account.id, amountOriginal: amount, payee } });
      if (dup) {
        skipped++;
        continue;
      }
    }
    const cat = matchByName(categories, col(row, m.category) || null);
    await createTransaction({
      accountId: account.id,
      categoryId: cat?.id ?? null,
      date,
      currency,
      amount,
      type: amount > 0 ? "income" : "expense",
      payee,
      note: col(row, m.note),
      tags: col(row, m.tags),
      source: "import",
      learn: false,
    });
    imported++;
  }
  return Response.json({ imported, skipped, errors: errors.slice(0, 20), errorCount: errors.length });
}
