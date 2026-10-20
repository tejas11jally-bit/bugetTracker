import { prisma } from "@/lib/db";
import { createTransaction, suggestCategory } from "@/lib/ledger";
import { matchByName, parseQuickAdd } from "@/lib/quick-add";
import { isCurrency, toMinor } from "@/lib/money";
import { parseDateInput, today } from "@/lib/dates";
import { saveToast } from "@/lib/toast";
import { getState, setState } from "@/lib/push";

type Body = {
  clientId?: string;
  text?: string;
  amount?: string | number;
  currency?: string;
  type?: "expense" | "income" | "transfer";
  categoryId?: number | null;
  accountId?: number | null;
  transferAccountId?: number | null;
  date?: string;
  payee?: string;
  note?: string;
  tags?: string;
  fxRate?: number | null;
};

const bad = (error: string) => Response.json({ ok: false, error }, { status: 400 });

// F1/F2 quick add and form. Also the target of the offline queue.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return bad("Invalid request");

  if (body.clientId) {
    const seen = await getState(`cid:${body.clientId}`);
    if (seen) return Response.json({ ok: true, id: Number(seen), toast: await saveToast(Number(seen)), duplicate: true });
  }

  const user = await prisma.user.findFirstOrThrow();
  const accounts = await prisma.account.findMany({ where: { archived: false }, orderBy: { id: "asc" } });
  if (accounts.length === 0) return bad("Add an account first (Settings → Accounts).");
  const categories = await prisma.category.findMany({ where: { archived: false } });

  let type: Body["type"] = body.type ?? "expense";
  let amountText = body.amount != null ? String(body.amount) : null;
  let currency: string | null = body.currency && isCurrency(body.currency) ? body.currency : null;
  let categoryId = body.categoryId ?? null;
  let account = accounts.find((a) => a.id === body.accountId);
  let payee = body.payee ?? "";
  let note = body.note ?? "";
  let tags = body.tags ?? "";

  if (body.text) {
    const p = parseQuickAdd(body.text);
    if (!p.amount) return bad("Start with an amount, like: 45 @groceries Carrefour");
    amountText = p.amount;
    currency = p.currency;
    payee = p.payee;
    note = p.note;
    tags = p.tags.join(",");
    const cat = matchByName(categories, p.category);
    if (p.category && !cat) return bad(`No category matches “${p.category}”.`);
    categoryId = cat?.id ?? null;
    type = p.income || cat?.group === "Income" ? "income" : "expense";
    if (p.account) {
      account = matchByName(accounts, p.account);
      if (!account) return bad(`No account matches “${p.account}”.`);
    }
  }

  account ??= accounts.find((a) => a.id === user.lastAccountId) ?? accounts[0];
  const cur: string = currency ?? account.currency;
  const minor = amountText ? toMinor(amountText, cur) : null;
  if (minor == null || minor <= 0) return bad("Enter an amount above zero.");
  const date = (body.date && parseDateInput(body.date)) || today(user.timezone);

  if (type === "transfer" && (!body.transferAccountId || body.transferAccountId === account.id)) return bad("Choose a different account to transfer to.");
  if (!categoryId && payee && type !== "transfer") categoryId = await suggestCategory(payee);

  const tx = await createTransaction({
    accountId: account.id,
    categoryId,
    date,
    currency: cur,
    amount: type === "income" ? minor : -minor,
    type: type ?? "expense",
    payee,
    note,
    tags,
    transferAccountId: type === "transfer" ? (body.transferAccountId ?? null) : null,
    fxRate: body.fxRate ?? null,
    source: "manual",
  });

  if (body.clientId) await setState(`cid:${body.clientId}`, String(tx.id));
  return Response.json({ ok: true, id: tx.id, toast: await saveToast(tx.id) });
}
