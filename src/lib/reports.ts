import { prisma } from "./db";
import { accountBalances, accountBalancesAED } from "./ledger";
import { addDays, addMonths, lastDayOfMonth } from "./dates";
import { computeBudget } from "./budget";
import { occurrences } from "./recurring";
import { getRate } from "./fx";
import { decimalsOf, toBase } from "./money";

type Num = bigint | number | null;
const n = (v: Num) => Number(v ?? 0);

/** F14: spending by category in a date range (AED fils, positive = spent). */
export async function spendingByCategory(from: string, to: string) {
  const rows = await prisma.$queryRaw<{ categoryId: number | null; total: Num; count: Num }[]>`
    SELECT category_id AS categoryId, -SUM(amount_base) AS total, COUNT(*) AS count
    FROM transactions WHERE type = 'expense' AND split = 0 AND date >= ${from} AND date <= ${to}
    GROUP BY category_id ORDER BY total DESC`;
  const cats = await prisma.category.findMany();
  return rows.map((r) => {
    const c = cats.find((x) => x.id === r.categoryId);
    return { categoryId: r.categoryId, name: c?.name ?? "Uncategorised", colour: c?.colour ?? "#94a3b8", icon: c?.icon ?? "•", total: n(r.total), count: n(r.count) };
  });
}

/** F14/F27: income, expense and net per month for the last `months` months. */
export async function monthlyCashFlow(endMonth: string, months = 12) {
  const start = addMonths(endMonth, -(months - 1));
  const rows = await prisma.$queryRaw<{ month: string; type: string; total: Num }[]>`
    SELECT substr(date, 1, 7) AS month, type, SUM(amount_base) AS total
    FROM transactions WHERE split = 0 AND type IN ('income', 'expense') AND date >= ${start + "-01"} AND date <= ${lastDayOfMonth(endMonth)}
    GROUP BY month, type`;
  const out = [];
  for (let m = start; m <= endMonth; m = addMonths(m, 1)) {
    const income = n(rows.find((r) => r.month === m && r.type === "income")?.total ?? 0);
    const expense = -n(rows.find((r) => r.month === m && r.type === "expense")?.total ?? 0);
    out.push({ month: m, income, expense, net: income - expense });
  }
  return out;
}

/** F14: payee ranking. */
export async function payeeRanking(from: string, to: string, limit = 15) {
  const rows = await prisma.$queryRaw<{ payee: string; total: Num; count: Num }[]>`
    SELECT payee, -SUM(amount_base) AS total, COUNT(*) AS count
    FROM transactions WHERE type = 'expense' AND parent_id IS NULL AND payee != '' AND date >= ${from} AND date <= ${to}
    GROUP BY lower(payee) ORDER BY total DESC LIMIT ${limit}`;
  return rows.map((r) => ({ payee: r.payee, total: n(r.total), count: n(r.count) }));
}

/** F27: spending by payment method (account, plus Apple Pay card label where known). */
export async function spendingByPaymentMethod(from: string, to: string) {
  const rows = await prisma.$queryRaw<{ accountId: number; cardLabel: string | null; total: Num }[]>`
    SELECT account_id AS accountId, card_label AS cardLabel, -SUM(amount_base) AS total
    FROM transactions WHERE type = 'expense' AND parent_id IS NULL AND date >= ${from} AND date <= ${to}
    GROUP BY account_id, card_label ORDER BY total DESC`;
  const accounts = await prisma.account.findMany();
  return rows.map((r) => {
    const a = accounts.find((x) => x.id === r.accountId);
    return { label: `${a?.name ?? "Unknown"}${r.cardLabel ? ` · ${r.cardLabel}` : ""}`, type: a?.type ?? "", total: n(r.total) };
  });
}

/** F27: budget performance by month. Also feeds the "Control" success metric. */
export async function budgetPerformance(endMonth: string, months = 6) {
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = addMonths(endMonth, -i);
    const b = await computeBudget(m);
    const budgeted = b.rows.filter((r) => r.assigned > 0 || r.carryIn > 0);
    const within = budgeted.filter((r) => r.available >= 0).length;
    out.push({ month: m, assigned: b.assignedTotal, spent: b.spentTotal, categories: budgeted.length, within });
  }
  return out;
}

/** F27: this month vs the average of the previous 3 months, per category. */
export async function categoryTrends(month: string) {
  const current = await spendingByCategory(`${month}-01`, lastDayOfMonth(month));
  const prevFrom = `${addMonths(month, -3)}-01`;
  const prevTo = lastDayOfMonth(addMonths(month, -1));
  const prev = await spendingByCategory(prevFrom, prevTo);
  const ids = new Set([...current, ...prev].map((r) => r.categoryId));
  return [...ids]
    .map((id) => {
      const c = current.find((r) => r.categoryId === id);
      const p = prev.find((r) => r.categoryId === id);
      const avg = Math.round((p?.total ?? 0) / 3);
      const now = c?.total ?? 0;
      return { categoryId: id, name: c?.name ?? p?.name ?? "", colour: c?.colour ?? p?.colour ?? "#94a3b8", current: now, average: avg, change: avg ? Math.round(((now - avg) / avg) * 100) : null };
    })
    .sort((a, b) => b.current - a.current);
}

/** F24: assets minus liabilities, current and at each of the last 12 month ends. */
export async function netWorth(endMonth: string, todayDate: string) {
  const split = (rows: Awaited<ReturnType<typeof accountBalancesAED>>) => {
    let assets = 0;
    let liabilities = 0;
    for (const r of rows) {
      if (r.balanceAED >= 0) assets += r.balanceAED;
      else liabilities += -r.balanceAED;
    }
    return { assets, liabilities, net: assets - liabilities };
  };
  const now = await accountBalancesAED();
  const trend = [];
  for (let i = 11; i >= 0; i--) {
    const m = addMonths(endMonth, -i);
    const asOf = i === 0 ? todayDate : lastDayOfMonth(m);
    trend.push({ month: m, ...split(await accountBalancesAED(asOf)) });
  }
  return { current: split(now), accounts: now, trend };
}

/** F19: 90-day projected balance per account from recurring items. */
export async function forecast(todayDate: string, days = 90) {
  const accounts = await prisma.account.findMany({ where: { archived: false } });
  const balances = await accountBalances();
  const items = await prisma.recurringItem.findMany({ where: { archived: false } });
  const end = addDays(todayDate, days);
  const result = [];
  for (const a of accounts) {
    const deltas = new Map<string, number>();
    for (const item of items.filter((i) => i.accountId === a.id)) {
      for (const d of occurrences(item, todayDate, end)) {
        let amount = item.amount;
        if (item.currency !== a.currency) {
          const from = (await getRate(item.currency, todayDate)).rate;
          const to = (await getRate(a.currency, todayDate)).rate;
          amount = Math.round(((toBase(item.amount, item.currency, from) / 100) / to) * 10 ** decimalsOf(a.currency));
        }
        deltas.set(d, (deltas.get(d) ?? 0) + amount);
      }
    }
    let bal = balances.get(a.id) ?? 0;
    const points: { date: string; balance: number }[] = [];
    let min = bal;
    for (let i = 0; i <= days; i++) {
      const d = addDays(todayDate, i);
      bal += deltas.get(d) ?? 0;
      min = Math.min(min, bal);
      points.push({ date: d, balance: bal });
    }
    const rate = (await getRate(a.currency, todayDate)).rate;
    result.push({ account: a, points, min, minAED: toBase(min, a.currency, rate), rate });
  }
  return result;
}
