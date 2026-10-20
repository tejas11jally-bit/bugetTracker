import { prisma } from "./db";
import { getRate } from "./fx";
import { decimalsOf, toBase } from "./money";
import { addDays, dayOfWeek, today } from "./dates";
import { raiseAlert, checkBudgetAlerts, checkLargeTransaction } from "./alerts";

export async function getSettings() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user");
  return user;
}

export async function userTz(): Promise<string> {
  const u = await prisma.user.findFirst({ select: { timezone: true } });
  return u?.timezone ?? "Asia/Dubai";
}

// ---------- Balances ----------

/** Balance per account in the account's own currency (minor units). */
export async function accountBalances(asOf?: string): Promise<Map<number, number>> {
  const accounts = await prisma.account.findMany();
  const dateFilter = asOf ? { date: { lte: asOf } } : {};
  const out = await prisma.transaction.groupBy({
    by: ["accountId"],
    where: { parentId: null, ...dateFilter },
    _sum: { amountOriginal: true },
  });
  const inn = await prisma.transaction.groupBy({
    by: ["transferAccountId"],
    where: { type: "transfer", transferAccountId: { not: null }, ...dateFilter },
    _sum: { transferAmount: true },
  });
  const map = new Map<number, number>();
  for (const a of accounts) map.set(a.id, a.openingBalance);
  for (const r of out) map.set(r.accountId, (map.get(r.accountId) ?? 0) + (r._sum.amountOriginal ?? 0));
  for (const r of inn) if (r.transferAccountId) map.set(r.transferAccountId, (map.get(r.transferAccountId) ?? 0) + (r._sum.transferAmount ?? 0));
  return map;
}

/** Balance of each account converted to AED fils at the latest known rate. */
export async function accountBalancesAED(asOf?: string) {
  const accounts = await prisma.account.findMany({ orderBy: [{ archived: "asc" }, { id: "asc" }] });
  const balances = await accountBalances(asOf);
  const date = asOf ?? today(await userTz());
  const rows = [];
  for (const a of accounts) {
    const balance = balances.get(a.id) ?? 0;
    const { rate } = await getRate(a.currency, date);
    rows.push({ account: a, balance, balanceAED: toBase(balance, a.currency, rate) });
  }
  return rows;
}

// ---------- Merchant rules (F22) ----------

export function normaliseMerchant(payee: string): string {
  return payee
    .toLowerCase()
    .replace(/[0-9#*]+/g, " ")
    .replace(/[^a-z؀-ۿ&' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

export async function suggestCategory(payee: string): Promise<number | null> {
  const key = normaliseMerchant(payee);
  if (!key) return null;
  const exact = await prisma.merchantRule.findUnique({ where: { matchText: key } });
  if (exact) return exact.categoryId;
  const rules = await prisma.merchantRule.findMany({ orderBy: { hitCount: "desc" } });
  const hit = rules
    .filter((r) => key.includes(r.matchText) || r.matchText.includes(key))
    .sort((a, b) => b.matchText.length - a.matchText.length || b.hitCount - a.hitCount)[0];
  return hit?.categoryId ?? null;
}

/** Learn payee → category from a user confirmation or correction. */
export async function learnRule(payee: string, categoryId: number) {
  const key = normaliseMerchant(payee);
  if (!key) return;
  await prisma.merchantRule.upsert({
    where: { matchText: key },
    create: { matchText: key, categoryId, hitCount: 1 },
    update: { categoryId, hitCount: { increment: 1 } },
  });
}

// ---------- Streaks and check-ins (F26) ----------

const MILESTONES = [7, 30, 100, 365];

export async function checkin(date: string, type: "logged" | "nothing_today") {
  const existing = await prisma.checkin.findUnique({ where: { date } });
  if (existing?.type === "logged") return refreshStreak();
  await prisma.checkin.upsert({ where: { date }, create: { date, type }, update: { type } });
  return refreshStreak();
}

export async function refreshStreak() {
  const tz = await userTz();
  const t = today(tz);
  const rows = await prisma.checkin.findMany({ where: { date: { lte: t } }, select: { date: true }, orderBy: { date: "desc" }, take: 800 });
  const days = new Set(rows.map((r) => r.date));
  let cursor = days.has(t) ? t : addDays(t, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  const user = await prisma.user.findFirst();
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { streakCount: streak, lastLogDate: rows[0]?.date ?? null } });
    if (MILESTONES.includes(streak) && days.has(t)) {
      await raiseAlert("milestone", `${streak}-day streak. Keep going.`, "/", `milestone:${streak}:${t}`);
    }
  }
  return streak;
}

/** Days of the current week (Mon–Sun by default) with check-in state. */
export async function weekStrip(tz: string, weekStart: number) {
  const t = today(tz);
  const offset = (dayOfWeek(t) - weekStart + 7) % 7;
  const start = addDays(t, -offset);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const rows = await prisma.checkin.findMany({ where: { date: { in: dates } } });
  const byDate = new Map(rows.map((r) => [r.date, r.type]));
  return dates.map((d) => ({ date: d, state: byDate.get(d) ?? null, isToday: d === t, future: d > t }));
}

// ---------- Creating transactions ----------

export type NewTransaction = {
  accountId: number;
  categoryId?: number | null;
  date: string;
  currency: string;
  amount: number; // signed minor units; negative = out of accountId
  type: "expense" | "income" | "transfer";
  payee?: string;
  note?: string;
  tags?: string[] | string;
  transferAccountId?: number | null;
  transferAmount?: number | null;
  source?: string;
  status?: "confirmed" | "review";
  cardLabel?: string | null;
  fxRate?: number | null;
  splits?: { categoryId: number; amount: number }[];
  recurringItemId?: number | null;
  receiptPath?: string | null;
  learn?: boolean;
};

function tagString(tags: string[] | string | undefined): string {
  if (!tags) return "";
  const list = Array.isArray(tags) ? tags : tags.split(",");
  return [...new Set(list.map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))].join(",");
}

export async function createTransaction(input: NewTransaction) {
  const rate = input.fxRate && input.fxRate > 0 ? input.fxRate : (await getRate(input.currency, input.date)).rate;
  const amountBase = toBase(input.amount, input.currency, rate);

  let transferAmount: number | null = null;
  if (input.type === "transfer") {
    if (!input.transferAccountId) throw new Error("Transfer needs a destination account");
    const dest = await prisma.account.findUniqueOrThrow({ where: { id: input.transferAccountId } });
    if (input.transferAmount != null) transferAmount = Math.abs(input.transferAmount);
    else if (dest.currency === input.currency) transferAmount = Math.abs(input.amount);
    else {
      const destRate = (await getRate(dest.currency, input.date)).rate;
      transferAmount = Math.round((Math.abs(amountBase) / 100 / destRate) * 10 ** decimalsOf(dest.currency));
    }
  }

  const splits = input.splits?.filter((s) => s.amount !== 0) ?? [];
  const isSplit = input.type !== "transfer" && splits.length > 1;

  const base = {
    accountId: input.accountId,
    date: input.date,
    currency: input.currency,
    fxRate: rate,
    payee: input.payee?.trim() ?? "",
    note: input.note?.trim() ?? "",
    tags: tagString(input.tags),
    type: input.type,
    source: input.source ?? "manual",
    status: input.status ?? "confirmed",
    cardLabel: input.cardLabel ?? null,
  };

  const tx = await prisma.transaction.create({
    data: {
      ...base,
      amountOriginal: input.amount,
      amountBase,
      categoryId: isSplit || input.type === "transfer" ? null : (input.categoryId ?? null),
      transferAccountId: input.type === "transfer" ? input.transferAccountId : null,
      transferAmount,
      split: isSplit,
      recurringItemId: input.recurringItemId ?? null,
      receiptPath: input.receiptPath ?? null,
    },
  });

  if (isSplit) await writeSplitChildren(tx.id, base, splits, rate, amountBase);

  await afterWrite(tx.id, input.learn ?? (input.source ?? "manual") === "manual");
  return tx;
}

async function writeSplitChildren(
  parentId: number,
  base: { accountId: number; date: string; currency: string; fxRate: number; payee: string; note: string; tags: string; type: string; source: string; status: string; cardLabel: string | null },
  splits: { categoryId: number; amount: number }[],
  rate: number,
  parentBase: number,
) {
  let allocated = 0;
  for (let i = 0; i < splits.length; i++) {
    const s = splits[i];
    // Last child absorbs rounding so children sum exactly to the parent in AED.
    const childBase = i === splits.length - 1 ? parentBase - allocated : toBase(s.amount, base.currency, rate);
    allocated += childBase;
    await prisma.transaction.create({
      data: {
        accountId: base.accountId,
        date: base.date,
        currency: base.currency,
        fxRate: base.fxRate,
        payee: base.payee,
        note: base.note,
        tags: base.tags,
        type: base.type,
        source: base.source,
        status: base.status,
        cardLabel: base.cardLabel,
        amountOriginal: s.amount,
        amountBase: childBase,
        categoryId: s.categoryId,
        parentId,
        split: false,
      },
    });
  }
}

/** Replace a transaction's split children (F5). Pass [] to un-split into `categoryId`. */
export async function setSplits(id: number, splits: { categoryId: number; amount: number }[], categoryId: number | null) {
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  await prisma.transaction.deleteMany({ where: { parentId: id } });
  const valid = splits.filter((s) => s.amount !== 0);
  if (valid.length > 1) {
    await prisma.transaction.update({ where: { id }, data: { split: true, categoryId: null } });
    await writeSplitChildren(id, tx, valid, tx.fxRate, tx.amountBase);
  } else {
    await prisma.transaction.update({ where: { id }, data: { split: false, categoryId } });
  }
  await afterWrite(id, false);
}

/** Side effects of any write: check-in, last-used account, rule learning, alerts. */
export async function afterWrite(id: number, learn: boolean) {
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) return;
  const tz = await userTz();
  if (tx.date === today(tz)) await checkin(tx.date, "logged");
  else await refreshStreak();
  const user = await prisma.user.findFirst();
  if (user && tx.source === "manual") await prisma.user.update({ where: { id: user.id }, data: { lastAccountId: tx.accountId } });
  if (learn && tx.payee && tx.categoryId && tx.type !== "transfer") await learnRule(tx.payee, tx.categoryId);
  if (tx.type === "expense") {
    const cats = tx.split
      ? (await prisma.transaction.findMany({ where: { parentId: tx.id }, select: { categoryId: true } })).map((c) => c.categoryId)
      : [tx.categoryId];
    for (const c of cats) if (c) await checkBudgetAlerts(c, tx.date.slice(0, 7));
    await checkLargeTransaction(tx.id);
  }
}

export async function deleteTransaction(id: number) {
  await prisma.transaction.deleteMany({ where: { parentId: id } });
  await prisma.transaction.delete({ where: { id } });
  await refreshStreak();
}

export async function duplicateTransaction(id: number, date: string) {
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id }, include: { children: true } });
  return createTransaction({
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    date,
    currency: tx.currency,
    amount: tx.amountOriginal,
    type: tx.type as NewTransaction["type"],
    payee: tx.payee,
    note: tx.note,
    tags: tx.tags,
    transferAccountId: tx.transferAccountId,
    transferAmount: tx.transferAmount,
    cardLabel: tx.cardLabel,
    splits: tx.children.map((c) => ({ categoryId: c.categoryId!, amount: c.amountOriginal })),
    learn: false,
  });
}

/** Categories ordered with the 6 most recently used first (F2). */
export async function categoriesByRecent() {
  const categories = await prisma.category.findMany({ where: { archived: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const recent = await prisma.transaction.findMany({
    where: { categoryId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { categoryId: true },
    take: 60,
  });
  const recentIds: number[] = [];
  for (const r of recent) if (r.categoryId && !recentIds.includes(r.categoryId)) recentIds.push(r.categoryId);
  return { categories, recentIds: recentIds.slice(0, 6) };
}
