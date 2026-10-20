import { prisma } from "@/lib/db";
import { verifyBearer } from "@/lib/auth";
import { createTransaction, suggestCategory } from "@/lib/ledger";
import { matchByName } from "@/lib/quick-add";
import { formatMoney, isCurrency, toMinor } from "@/lib/money";
import { parseAmount } from "@/lib/ingest";
import { today } from "@/lib/dates";

// F20 Apple Pay capture and F21 Quick Log. Called by iOS Shortcuts with a bearer token.
//   POST /api/ingest   Authorization: Bearer ldg_…
//   { "amount": "AED 45.00", "merchant": "Carrefour", "card": "Visa", "source": "apple_pay" }
//   { "amount": 12, "category": "Coffee", "source": "quick_log" }

export async function POST(req: Request) {
  const token = await verifyBearer(req.headers.get("authorization"));
  if (!token) return Response.json({ ok: false, message: "Invalid or revoked token" }, { status: 401 });

  let body: Record<string, unknown> = {};
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  else body = Object.fromEntries((await req.formData().catch(() => new FormData())).entries());

  const source = body.source === "quick_log" ? "quick_log" : "apple_pay";
  const user = await prisma.user.findFirstOrThrow();
  const accounts = await prisma.account.findMany({ where: { archived: false }, orderBy: { id: "asc" } });
  if (!accounts.length) return Response.json({ ok: false, message: "Add an account in Ledgerly first" }, { status: 400 });

  const card = String(body.card ?? "").trim();
  const account =
    (body.account ? matchByName(accounts, String(body.account)) : undefined) ??
    (card ? accounts.find((a) => card.toLowerCase().includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(card.toLowerCase())) : undefined) ??
    (card ? accounts.find((a) => a.type === "credit" || a.type === "debit") : undefined) ??
    accounts.find((a) => a.id === user.lastAccountId) ??
    accounts[0];

  const parsed = parseAmount(body.amount);
  const currency = (typeof body.currency === "string" && isCurrency(body.currency.toUpperCase()) ? body.currency.toUpperCase() : null) ?? parsed.currency ?? account.currency;
  const minor = parsed.value ? toMinor(parsed.value, currency) : null;
  if (!minor || minor <= 0) return Response.json({ ok: false, message: `Could not read amount “${String(body.amount ?? "")}”` }, { status: 400 });

  const merchant = String(body.merchant ?? body.payee ?? "").trim();
  const categories = await prisma.category.findMany({ where: { archived: false } });
  const named = body.category ? matchByName(categories, String(body.category)) : undefined;
  const categoryId = named?.id ?? (merchant ? await suggestCategory(merchant) : null);
  const income = named?.group === "Income";

  const tx = await createTransaction({
    accountId: account.id,
    categoryId,
    date: today(user.timezone),
    currency,
    amount: income ? minor : -minor,
    type: income ? "income" : "expense",
    payee: merchant,
    note: String(body.note ?? ""),
    source,
    // Apple Pay entries wait in Review until confirmed. Quick Log with a category is already confirmed.
    status: source === "apple_pay" || !categoryId ? "review" : "confirmed",
    cardLabel: card || null,
    learn: false,
  });

  const cat = categories.find((c) => c.id === categoryId);
  const message = `Logged ${formatMoney(minor, currency)}${cat ? ` · ${cat.name}` : ""}${tx.status === "review" ? " · in Review" : ""}`;
  return Response.json({ ok: true, id: tx.id, message });
}
