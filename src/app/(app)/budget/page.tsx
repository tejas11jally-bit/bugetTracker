import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeBudget, dailyAllowance, safeToSpend } from "@/lib/budget";
import { addMonths, currentMonth, formatMonth, lastDayOfMonth, today } from "@/lib/dates";
import { minorToInput } from "@/lib/money";
import { Card, Money, Page, Progress, btn } from "@/components/ui";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/auto-submit-input";
import { assign, copyPrevious, cover, rollover } from "@/app/actions/budget";

const GROUPS = ["Essentials", "Lifestyle", "Savings"];

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ month?: string; close?: string }> }) {
  const sp = await searchParams;
  const user = await prisma.user.findFirstOrThrow();
  const tz = user.timezone;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth(tz);
  const budget = await computeBudget(month);
  const { daysLeft } = safeToSpend(budget, tz);
  const isCurrent = month === currentMonth(tz);
  const closing = sp.close === "1" || (isCurrent && today(tz) === lastDayOfMonth(month));
  const nextMonth = addMonths(month, 1);
  const nextHasBudget = (await prisma.budget.count({ where: { month: nextMonth, assignedAmount: { gt: 0 } } })) > 0;
  const prevHasBudget = (await prisma.budget.count({ where: { month: addMonths(month, -1) } })) > 0;
  const ltb = budget.leftToBudget;
  const donors = budget.rows.filter((r) => r.available > 0);

  return (
    <Page
      title="Budget"
      subtitle={
        <span className="flex items-center gap-2">
          <Link href={`/budget?month=${addMonths(month, -1)}`} className={btn.ghost} aria-label="Previous month">
            ←
          </Link>
          <span className="font-medium text-foreground">{formatMonth(month)}</span>
          <Link href={`/budget?month=${nextMonth}`} className={btn.ghost} aria-label="Next month">
            →
          </Link>
        </span>
      }
      actions={
        prevHasBudget && (
          <form action={copyPrevious}>
            <input type="hidden" name="month" value={month} />
            <button className={btn.secondary}>Copy last month</button>
          </form>
        )
      }
    >
      <section
        className={`rounded-2xl p-4 text-white shadow-sm ${ltb < 0 ? "bg-red-700" : ltb === 0 ? "bg-slate-700" : "bg-accent"}`}
        aria-label="Left to Budget"
      >
        <p className="text-sm opacity-90">Left to Budget</p>
        <p className="text-3xl font-bold">
          <Money amount={ltb} />
        </p>
        <p className="mt-2 text-xs opacity-90">
          From last month <Money amount={budget.fromLastMonth} /> + income <Money amount={budget.income} /> − assigned <Money amount={budget.assignedTotal} />
          {budget.uncategorised !== 0 && (
            <>
              {" "}
              − uncategorised spending <Money amount={budget.uncategorised} />
            </>
          )}
        </p>
        <p className="mt-1 text-xs opacity-90">{ltb > 0 ? "Assign every dirham to a category." : ltb < 0 ? "You've assigned more than you have. Reduce a category." : "Every dirham has a job."}</p>
      </section>

      {closing && (
        <Card title="Month close">
          <p className="text-sm text-muted">
            Overspending stays in its category and carries into next month unless you cover it. Categories set to &ldquo;Reset&rdquo; return their leftover to Left to Budget.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!nextHasBudget && (
              <form action={copyPrevious}>
                <input type="hidden" name="month" value={nextMonth} />
                <button className={btn.primary}>Set up {formatMonth(nextMonth)} from this month</button>
              </form>
            )}
            <Link href={`/budget?month=${nextMonth}`} className={btn.secondary}>
              Go to {formatMonth(nextMonth)}
            </Link>
          </div>
        </Card>
      )}

      {GROUPS.map((group) => {
        const rows = budget.rows.filter((r) => r.group === group);
        if (!rows.length) return null;
        return (
          <Card key={group} title={group}>
            <ul className="flex flex-col divide-y divide-line">
              {rows.map((r) => {
                const funded = r.assigned + r.carryIn;
                return (
                  <li key={r.categoryId} className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {r.icon} {r.name}
                      </span>
                      <form action={assign} className="w-28">
                        <input type="hidden" name="categoryId" value={r.categoryId} />
                        <input type="hidden" name="month" value={month} />
                        <AutoSubmitInput
                          name="amount"
                          defaultValue={r.assigned ? minorToInput(r.assigned, "AED") : ""}
                          placeholder="0"
                          inputMode="decimal"
                          className="tabular w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-right text-sm"
                          aria-label={`Assigned to ${r.name}`}
                        />
                      </form>
                    </div>
                    <div className="mt-2">
                      <Progress value={r.spent} max={funded} colour={r.colour} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-2">
                        <form action={rollover}>
                          <input type="hidden" name="categoryId" value={r.categoryId} />
                          <input type="hidden" name="month" value={month} />
                          <AutoSubmitSelect name="mode" defaultValue={r.rolloverMode} className="rounded border-0 bg-black/5 px-1 py-0.5 text-[11px] dark:bg-white/10" aria-label={`Rollover for ${r.name}`} title="What happens to the leftover next month">
                            <option value="carry">Carry</option>
                            <option value="reset">Reset</option>
                          </AutoSubmitSelect>
                        </form>
                        <span>
                        Spent <Money amount={r.spent} />
                        {r.carryIn !== 0 && (
                          <>
                            {" "}
                            · carried <Money amount={r.carryIn} />
                          </>
                        )}
                        </span>
                      </span>
                      <span className={r.available < 0 ? "font-semibold text-red-700 dark:text-red-400" : "font-semibold text-foreground"}>
                        {r.available < 0 ? "Over " : "Left "}
                        <Money amount={Math.abs(r.available)} />
                        {isCurrent && r.available > 0 && (
                          <span className="font-normal text-muted">
                            {" "}
                            · <Money amount={dailyAllowance(r, daysLeft)} />
                            /day
                          </span>
                        )}
                      </span>
                    </div>
                    {r.available < 0 && donors.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <form action={cover} className="flex flex-wrap items-center gap-1">
                          <input type="hidden" name="to" value={r.categoryId} />
                          <input type="hidden" name="month" value={month} />
                          <input type="hidden" name="amount" value={minorToInput(-r.available, "AED")} />
                          <select name="from" className="rounded-md border border-line bg-surface px-1.5 py-1" aria-label="Cover from">
                            {donors.map((d) => (
                              <option key={d.categoryId} value={d.categoryId}>
                                Cover from {d.name}
                              </option>
                            ))}
                          </select>
                          <button className={btn.ghost}>Cover</button>
                        </form>
                    </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </Page>
  );
}
