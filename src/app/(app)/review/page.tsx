import Link from "next/link";
import { prisma } from "@/lib/db";
import { addDays, dayOfWeek, formatDate, today } from "@/lib/dates";
import { computeBudget } from "@/lib/budget";
import { Badge, Card, Empty, Money, Page, Progress, btn } from "@/components/ui";
import { confirmAllReview, confirmReview } from "@/app/actions/ledger";

// Review queue (F20) and the Friday "Weekly review" reminder target.
export default async function ReviewPage() {
  const user = await prisma.user.findFirstOrThrow();
  const t = today(user.timezone);
  const weekFrom = addDays(t, -((dayOfWeek(t) - user.weekStart + 7) % 7));
  const [items, categories, weekRows, budget] = await Promise.all([
    prisma.transaction.findMany({ where: { status: "review", parentId: null }, include: { category: true, account: true }, orderBy: [{ date: "desc" }, { id: "desc" }] }),
    prisma.category.findMany({ where: { archived: false }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }] }),
    prisma.transaction.findMany({ where: { date: { gte: weekFrom, lte: t }, type: "expense", split: false }, include: { category: true } }),
    computeBudget(t.slice(0, 7)),
  ]);
  const weekSpent = -weekRows.reduce((s, r) => s + r.amountBase, 0);
  const byCat = new Map<string, number>();
  for (const r of weekRows) byCat.set(r.category?.name ?? "Uncategorised", (byCat.get(r.category?.name ?? "Uncategorised") ?? 0) - r.amountBase);
  const funded = budget.rows.reduce((s, r) => s + Math.max(r.assigned + r.carryIn, 0), 0);
  const over = budget.rows.filter((r) => r.available < 0);

  return (
    <Page title="Review" subtitle={`Week of ${formatDate(weekFrom)}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="This week">
          <p className="text-3xl font-bold">
            <Money amount={weekSpent} />
          </p>
          <p className="text-sm text-muted">{weekRows.length} purchases</p>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {[...byCat.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([name, v]) => (
                <li key={name} className="flex justify-between">
                  <span>{name}</span>
                  <Money amount={v} />
                </li>
              ))}
          </ul>
        </Card>
        <Card title="Month so far">
          <p className="text-sm">
            <Money amount={budget.spentTotal} /> of <Money amount={funded} />
          </p>
          <div className="mt-2">
            <Progress value={budget.spentTotal} max={funded} />
          </div>
          {over.length > 0 && (
            <p className="mt-3 text-sm">
              Over budget: {over.map((r) => r.name).join(", ")}.{" "}
              <Link href="/budget" className="text-accent underline">
                Cover it
              </Link>
            </p>
          )}
        </Card>
      </div>

      <Card
        title={`Waiting for review (${items.length})`}
        action={
          items.length > 1 && (
            <form action={confirmAllReview}>
              <button className={btn.ghost}>Confirm all</button>
            </form>
          )
        }
      >
        {items.length === 0 ? (
          <Empty>Nothing to review. Apple Pay purchases appear here until you confirm them.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((tx) => (
              <li key={tx.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <Link href={`/transactions/${tx.id}`} className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {tx.payee || "Unknown merchant"} {tx.cardLabel && <Badge>{tx.cardLabel}</Badge>}
                  </span>
                  <span className="text-xs text-muted">
                    {formatDate(tx.date)} · {tx.account.name}
                  </span>
                </Link>
                <Money amount={tx.amountOriginal} currency={tx.currency} className="font-semibold" />
                <form action={confirmReview} className="flex gap-2">
                  <input type="hidden" name="id" value={tx.id} />
                  <select name="categoryId" defaultValue={tx.categoryId ?? ""} className="min-w-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" aria-label="Category">
                    <option value="">Uncategorised</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                  <button className={btn.primary}>Confirm</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
