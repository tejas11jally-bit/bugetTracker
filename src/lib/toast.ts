import { prisma } from "./db";
import { computeBudget } from "./budget";
import { formatAED } from "./money";

/** F3 toast: "Coffee: AED 118 left this month. 12-day streak." */
export async function saveToast(txId: number): Promise<string> {
  const tx = await prisma.transaction.findUnique({ where: { id: txId }, include: { category: true, children: { include: { category: true } } } });
  const user = await prisma.user.findFirst();
  const streak = user?.streakCount ?? 0;
  const streakText = streak > 0 ? ` ${streak}-day streak.` : "";
  if (!tx) return "Saved.";
  if (tx.type === "transfer") return `Transfer saved.${streakText}`;
  if (tx.type === "income") return `Income saved: ${formatAED(tx.amountBase)}.${streakText}`;
  const category = tx.category ?? tx.children[0]?.category;
  if (!category) return `Saved.${streakText}`;
  const budget = await computeBudget(tx.date.slice(0, 7));
  const row = budget.rows.find((r) => r.categoryId === category.id);
  let detail: string;
  if (!row || (row.assigned === 0 && row.carryIn === 0)) detail = `${formatAED(row?.spent ?? 0)} spent this month.`;
  else if (row.available < 0) detail = `${formatAED(-row.available)} over budget.`;
  else detail = `${formatAED(row.available)} left this month.`;
  const name = tx.split ? `${category.name} +${tx.children.length - 1}` : category.name;
  return `${name}: ${detail}${streakText}`;
}
