import { prisma } from "./db";
import { addMonths, daysInMonth, today } from "./dates";

// F9/F10 zero-based budget, YNAB-style money flow:
//   available(cat, M)   = carryIn(cat, M) + assigned(cat, M) − spent(cat, M)
//   carryIn(cat, M)     = available(cat, M−1) if last month's mode is "carry", else 0
//   leftToBudget(M)     = leftToBudget(M−1) + returned(M) + income(M) − assigned(M) − uncategorised(M)
//   returned(M)         = sum of available(cat, M−1) for "reset" categories (leftover back, overspend out)
// All amounts in AED fils. Spent is positive for money out.

export type BudgetRow = {
  categoryId: number;
  name: string;
  group: string;
  icon: string;
  colour: string;
  assigned: number;
  spent: number;
  carryIn: number;
  available: number;
  rolloverMode: string;
};

export type MonthBudget = {
  month: string;
  rows: BudgetRow[];
  income: number;
  assignedTotal: number;
  spentTotal: number;
  fromLastMonth: number; // previous Left to Budget + returned reset balances
  uncategorised: number;
  leftToBudget: number;
};

async function monthlyAggregates() {
  const spend = await prisma.$queryRaw<{ month: string; categoryId: number | null; total: bigint | number }[]>`
    SELECT substr(date, 1, 7) AS month, category_id AS categoryId, SUM(amount_base) AS total
    FROM transactions
    WHERE type = 'expense' AND split = 0
    GROUP BY month, category_id`;
  const income = await prisma.$queryRaw<{ month: string; total: bigint | number }[]>`
    SELECT substr(date, 1, 7) AS month, SUM(amount_base) AS total
    FROM transactions
    WHERE type = 'income' AND split = 0
    GROUP BY month`;
  return { spend, income };
}

export async function computeBudget(month: string): Promise<MonthBudget> {
  const categories = await prisma.category.findMany({ where: { group: { not: "Income" } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const budgets = await prisma.budget.findMany({ where: { month: { lte: month } } });
  const { spend, income } = await monthlyAggregates();

  const months = [...budgets.map((b) => b.month), ...spend.map((s) => s.month), ...income.map((i) => i.month)].filter((m) => m <= month);
  let start = months.length ? months.reduce((a, b) => (a < b ? a : b)) : month;
  const floor = addMonths(month, -60);
  if (start < floor) start = floor;

  const assignedMap = new Map(budgets.map((b) => [`${b.categoryId}:${b.month}`, b]));
  const spentMap = new Map<string, number>();
  const uncategorisedMap = new Map<string, number>();
  for (const s of spend) {
    const v = -Number(s.total);
    if (s.categoryId == null) uncategorisedMap.set(s.month, (uncategorisedMap.get(s.month) ?? 0) + v);
    else spentMap.set(`${s.categoryId}:${s.month}`, v);
  }
  const incomeMap = new Map(income.map((i) => [i.month, Number(i.total)]));

  const available = new Map<number, number>();
  const modes = new Map<number, string>();
  let ltb = 0;
  let result: MonthBudget | null = null;

  for (let m = start; m <= month; m = addMonths(m, 1)) {
    let returned = 0;
    const rows: BudgetRow[] = [];
    for (const c of categories) {
      const prevAvail = available.get(c.id) ?? 0;
      const prevMode = modes.get(c.id) ?? "carry";
      const carryIn = prevMode === "carry" ? prevAvail : 0;
      if (prevMode === "reset") returned += prevAvail;
      const b = assignedMap.get(`${c.id}:${m}`);
      const assigned = b?.assignedAmount ?? 0;
      const spent = spentMap.get(`${c.id}:${m}`) ?? 0;
      const avail = carryIn + assigned - spent;
      available.set(c.id, avail);
      modes.set(c.id, b?.rolloverMode ?? prevMode);
      rows.push({
        categoryId: c.id,
        name: c.name,
        group: c.group,
        icon: c.icon,
        colour: c.colour,
        assigned,
        spent,
        carryIn,
        available: avail,
        rolloverMode: b?.rolloverMode ?? prevMode,
      });
    }
    const inc = incomeMap.get(m) ?? 0;
    const assignedTotal = rows.reduce((s, r) => s + r.assigned, 0);
    const uncategorised = uncategorisedMap.get(m) ?? 0;
    const fromLastMonth = ltb + returned;
    ltb = fromLastMonth + inc - assignedTotal - uncategorised;
    if (m === month) {
      result = {
        month,
        rows: rows.filter((r) => !categories.find((c) => c.id === r.categoryId)?.archived || r.assigned || r.spent || r.available),
        income: inc,
        assignedTotal,
        spentTotal: rows.reduce((s, r) => s + r.spent, 0),
        fromLastMonth,
        uncategorised,
        leftToBudget: ltb,
      };
    }
  }
  return result!;
}

export async function setAssigned(categoryId: number, month: string, assignedAmount: number) {
  await prisma.budget.upsert({
    where: { categoryId_month: { categoryId, month } },
    create: { categoryId, month, assignedAmount, rolloverMode: await previousMode(categoryId, month) },
    update: { assignedAmount },
  });
}

async function previousMode(categoryId: number, month: string) {
  const prev = await prisma.budget.findFirst({ where: { categoryId, month: { lt: month } }, orderBy: { month: "desc" } });
  return prev?.rolloverMode ?? "carry";
}

export async function setRolloverMode(categoryId: number, month: string, mode: "carry" | "reset") {
  await prisma.budget.upsert({
    where: { categoryId_month: { categoryId, month } },
    create: { categoryId, month, assignedAmount: 0, rolloverMode: mode },
    update: { rolloverMode: mode },
  });
}

/** F10: copy last month's assigned amounts in one click. */
export async function copyLastMonth(month: string) {
  const prev = await prisma.budget.findMany({ where: { month: addMonths(month, -1) } });
  for (const b of prev) {
    await prisma.budget.upsert({
      where: { categoryId_month: { categoryId: b.categoryId, month } },
      create: { categoryId: b.categoryId, month, assignedAmount: b.assignedAmount, rolloverMode: b.rolloverMode },
      update: { assignedAmount: b.assignedAmount },
    });
  }
  return prev.length;
}

/** F10: cover an overspend by moving assigned money from another category. */
export async function moveMoney(fromCategoryId: number, toCategoryId: number, month: string, amount: number) {
  const get = (categoryId: number) => prisma.budget.findUnique({ where: { categoryId_month: { categoryId, month } } });
  const from = await get(fromCategoryId);
  const to = await get(toCategoryId);
  await setAssigned(fromCategoryId, month, (from?.assignedAmount ?? 0) - amount);
  await setAssigned(toCategoryId, month, (to?.assignedAmount ?? 0) + amount);
}

/** Safe to spend today: what's left in spending categories, spread over the days left this month. */
export function safeToSpend(budget: MonthBudget, tz: string) {
  const t = today(tz);
  const daysLeft = t.slice(0, 7) === budget.month ? daysInMonth(budget.month) - Number(t.slice(8, 10)) + 1 : daysInMonth(budget.month);
  const pool = budget.rows.filter((r) => r.group !== "Savings").reduce((s, r) => s + Math.max(r.available, 0), 0);
  return { perDay: Math.floor(pool / Math.max(daysLeft, 1)), pool, daysLeft };
}

/** Daily allowance for one category for the rest of the month. */
export function dailyAllowance(row: BudgetRow, daysLeft: number) {
  return Math.floor(Math.max(row.available, 0) / Math.max(daysLeft, 1));
}
