import type { RecurringItem } from "@prisma/client";
import { prisma } from "./db";
import { addDays, addMonthsToDate } from "./dates";
import { createTransaction } from "./ledger";

export const CADENCES = ["weekly", "fortnightly", "monthly", "quarterly", "yearly", "custom"] as const;

/** Next due date after `date` for this cadence. Monthly-type cadences keep the original day of month. */
export function nextDate(item: Pick<RecurringItem, "cadence" | "interval">, date: string, anchorDay?: number): string {
  switch (item.cadence) {
    case "weekly":
      return addDays(date, 7);
    case "fortnightly":
      return addDays(date, 14);
    case "monthly":
      return addMonthsToDate(date, 1, anchorDay);
    case "quarterly":
      return addMonthsToDate(date, 3, anchorDay);
    case "yearly":
      return addMonthsToDate(date, 12, anchorDay);
    default:
      return addDays(date, Math.max(1, item.interval));
  }
}

/** All due dates of an item in [from, to]. */
export function occurrences(item: RecurringItem, from: string, to: string): string[] {
  const out: string[] = [];
  const anchor = Number(item.nextDueDate.slice(8, 10));
  let d = item.nextDueDate;
  let guard = 0;
  while (d <= to && guard++ < 1000) {
    if (d >= from) out.push(d);
    d = nextDate(item, d, anchor);
  }
  return out;
}

/** Mark paid in one tap (F11): posts the transaction and advances the due date. */
export async function markPaid(id: number, opts: { date?: string; source?: string } = {}) {
  const item = await prisma.recurringItem.findUniqueOrThrow({ where: { id } });
  const date = opts.date ?? item.nextDueDate;
  const tx = await createTransaction({
    accountId: item.accountId,
    categoryId: item.categoryId,
    date,
    currency: item.currency,
    amount: item.amount,
    type: item.amount < 0 ? "expense" : "income",
    payee: item.name,
    source: opts.source ?? "recurring",
    recurringItemId: item.id,
    learn: false,
  });
  await skip(id);
  return tx;
}

/** Advance to the next due date without posting. */
export async function skip(id: number) {
  const item = await prisma.recurringItem.findUniqueOrThrow({ where: { id } });
  const anchor = Number(item.nextDueDate.slice(8, 10));
  await prisma.recurringItem.update({ where: { id }, data: { nextDueDate: nextDate(item, item.nextDueDate, anchor) } });
}

export async function upcoming(fromDate: string, days: number) {
  const to = addDays(fromDate, days);
  const items = await prisma.recurringItem.findMany({ where: { archived: false }, include: { category: true, account: true } });
  return items
    .flatMap((item) => occurrences(item, "0000-00-00", to).map((date) => ({ item, date, overdue: date < fromDate })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Auto-post items due on or before `date`. Returns posted items for the notification. */
export async function autoPostDue(date: string) {
  const due = await prisma.recurringItem.findMany({ where: { archived: false, autoPost: true, nextDueDate: { lte: date } } });
  const posted: RecurringItem[] = [];
  for (const item of due) {
    // Catch up every missed occurrence, bounded.
    let guard = 0;
    let current = item;
    while (current.nextDueDate <= date && guard++ < 24) {
      await markPaid(current.id, { source: "recurring" });
      posted.push(current);
      current = await prisma.recurringItem.findUniqueOrThrow({ where: { id: item.id } });
    }
  }
  return posted;
}
