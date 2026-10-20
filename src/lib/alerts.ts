import { prisma } from "./db";
import { addDays, today } from "./dates";
import { formatAED } from "./money";
import { computeBudget } from "./budget";

// F15 in-app bell. dedupeKey makes each alert fire once.
export async function raiseAlert(type: string, message: string, link: string, dedupeKey: string) {
  await prisma.alert.upsert({ where: { dedupeKey }, create: { type, message, link, dedupeKey }, update: {} });
}

export async function checkBudgetAlerts(categoryId: number, month: string) {
  const budget = await computeBudget(month);
  const row = budget.rows.find((r) => r.categoryId === categoryId);
  if (!row) return;
  const funded = row.assigned + row.carryIn;
  if (funded <= 0 && row.spent <= 0) return;
  if (row.available < 0) {
    await raiseAlert("over_budget", `${row.name} is over budget by ${formatAED(-row.available)}.`, `/budget?month=${month}`, `over:${categoryId}:${month}`);
  } else if (funded > 0 && row.spent >= funded * 0.8) {
    await raiseAlert("budget_80", `${row.name} has used ${Math.round((row.spent / funded) * 100)}% of its budget.`, `/budget?month=${month}`, `b80:${categoryId}:${month}`);
  }
}

/** Unusually large: over 3× the category's 90-day average spend, and at least AED 200. */
export async function checkLargeTransaction(id: number) {
  const tx = await prisma.transaction.findUnique({ where: { id }, include: { category: true } });
  if (!tx || tx.type !== "expense") return;
  const size = -tx.amountBase;
  if (size < 20_000) return;
  const since = addDays(tx.date, -90);
  const history = await prisma.transaction.aggregate({
    where: { type: "expense", split: false, categoryId: tx.categoryId, date: { gte: since }, id: { not: tx.id } },
    _avg: { amountBase: true },
    _count: true,
  });
  const avg = -(history._avg.amountBase ?? 0);
  const unusual = history._count >= 5 ? size > avg * 3 : size >= 100_000;
  if (unusual) {
    const label = tx.payee || tx.category?.name || "A transaction";
    await raiseAlert("large_tx", `${label}: ${formatAED(size)} is unusually large.`, `/transactions/${tx.id}`, `large:${tx.id}`);
  }
}

export async function checkBillsDueTomorrow(tz: string) {
  const tomorrow = addDays(today(tz), 1);
  const bills = await prisma.recurringItem.findMany({ where: { archived: false, nextDueDate: tomorrow, amount: { lt: 0 } } });
  for (const b of bills) {
    await raiseAlert("bill_tomorrow", `${b.name} is due tomorrow.`, `/bills?focus=${b.id}`, `bill:${b.id}:${tomorrow}`);
  }
  return bills;
}
