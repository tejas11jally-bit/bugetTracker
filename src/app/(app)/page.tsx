import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeBudget, safeToSpend } from "@/lib/budget";
import { today, formatDate, formatDateTime, addDays } from "@/lib/dates";
import { upcoming } from "@/lib/recurring";
import { weekStrip, refreshStreak } from "@/lib/ledger";
import { getState } from "@/lib/push";
import { Card, Money, Page, Progress, btn, Badge } from "@/components/ui";
import { dismissChecklist } from "@/app/actions/settings";

export default async function Dashboard() {
  const user = await prisma.user.findFirstOrThrow();
  const tz = user.timezone;
  const t = today(tz);
  const month = t.slice(0, 7);
  const streak = await refreshStreak();
  const [budget, bills, week, heartbeat, lastReminder, lastBackup, review, counts] = await Promise.all([
    computeBudget(month),
    upcoming(t, 7),
    weekStrip(tz, user.weekStart),
    getState("heartbeat"),
    getState("last_reminder_sent"),
    getState("last_backup"),
    prisma.transaction.count({ where: { status: "review", parentId: null } }),
    Promise.all([
      prisma.account.count(),
      prisma.budget.count({ where: { assignedAmount: { gt: 0 } } }),
      prisma.pushSubscription.count({ where: { active: true } }),
      prisma.transaction.count({ where: { source: "apple_pay" } }),
      prisma.apiToken.count({ where: { revoked: false } }),
    ]),
  ]);
  const safe = safeToSpend(budget, tz);
  const top = [...budget.rows].filter((r) => r.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 5);
  const funded = budget.rows.reduce((s, r) => s + Math.max(r.assigned + r.carryIn, 0), 0);

  const [accounts, budgets, devices, applePay, tokens] = counts;
  const checklist = [
    { done: accounts > 0, label: "Add your accounts", href: "/accounts" },
    { done: budgets > 0, label: "Set this month's budget", href: "/budget" },
    { done: !!user.appInstalledAt, label: "Install the app on your Home Screen", href: "/onboarding" },
    { done: devices > 0, label: "Turn on reminders", href: "/settings/reminders" },
    { done: applePay > 0 || tokens > 0, label: "Set up the Apple Pay shortcut", href: "/settings/shortcuts" },
  ];
  const showChecklist = !user.checklistDismissed && checklist.some((c) => !c.done);
  const beatAge = heartbeat ? Date.now() - new Date(heartbeat).getTime() : Infinity;

  return (
    <Page title={`Hi ${user.name.split(" ")[0]}`} subtitle={formatDate(t)}>
      {showChecklist && (
        <Card title="Getting started" action={<form action={dismissChecklist}><button className={btn.ghost}>Hide</button></form>}>
          <ol className="flex flex-col gap-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className="flex items-center gap-3 text-sm">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${c.done ? "border-accent bg-accent text-white" : "border-line"}`} aria-hidden>
                    {c.done ? "✓" : ""}
                  </span>
                  <span className={c.done ? "text-muted line-through" : ""}>{c.label}</span>
                  <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-muted">Safe to spend today</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">
            <Money amount={safe.perDay} />
          </p>
          <p className="mt-1 text-xs text-muted">
            <Money amount={safe.pool} /> left across spending categories, {safe.daysLeft} day{safe.daysLeft === 1 ? "" : "s"} to go.
          </p>
        </Card>
        <Card>
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted">This month</p>
            <Link href="/budget" className={btn.ghost}>
              Budget
            </Link>
          </div>
          <p className="mt-1 text-2xl font-bold">
            <Money amount={budget.spentTotal} /> <span className="text-base font-normal text-muted">of <Money amount={funded} /></span>
          </p>
          <div className="mt-3">
            <Progress value={budget.spentTotal} max={funded} />
          </div>
          {budget.leftToBudget !== 0 && (
            <p className={`mt-2 text-xs ${budget.leftToBudget < 0 ? "text-red-700 dark:text-red-400" : "text-muted"}`}>
              Left to Budget: <Money amount={budget.leftToBudget} />
            </p>
          )}
        </Card>
      </div>

      {review > 0 && (
        <Link href="/review" className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          <span>
            <strong>{review}</strong> Apple Pay purchase{review === 1 ? "" : "s"} waiting for review
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <Card title="Top categories">
        {top.length === 0 ? (
          <p className="text-sm text-muted">No spending yet this month.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {top.map((r) => {
              const f = r.assigned + r.carryIn;
              return (
                <li key={r.categoryId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>
                      {r.icon} {r.name}
                    </span>
                    <span className="tabular text-muted">
                      <Money amount={r.spent} />
                      {f > 0 && (
                        <>
                          {" "}
                          / <Money amount={f} />
                        </>
                      )}
                    </span>
                  </div>
                  {f > 0 ? (
                    <Progress value={r.spent} max={f} colour={r.colour} />
                  ) : (
                    <Link href="/budget" className="text-xs text-muted underline">
                      No budget set
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Bills due in 7 days" action={<Link href="/bills" className={btn.ghost}>All bills</Link>}>
        {bills.length === 0 ? (
          <p className="text-sm text-muted">Nothing due.</p>
        ) : (
          <ul className="divide-y divide-line">
            {bills.map(({ item, date, overdue }) => (
              <li key={`${item.id}-${date}`} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/bills?focus=${item.id}`}>
                  {item.name} {overdue ? <Badge tone="bad">Overdue</Badge> : date === t ? <Badge tone="warn">Today</Badge> : date === addDays(t, 1) ? <Badge tone="warn">Tomorrow</Badge> : null}
                  <span className="block text-xs text-muted">{formatDate(date)}</span>
                </Link>
                <Money amount={item.amount} currency={item.currency} colour />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Streak">
        <div className="flex items-center gap-4">
          <p className="text-4xl font-bold">{streak}</p>
          <p className="text-sm text-muted">
            day{streak === 1 ? "" : "s"} in a row
            <br />
            Next milestone: {[7, 30, 100, 365].find((m) => m > streak) ?? "∞"} days
          </p>
        </div>
        <ol className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px]" aria-label="This week">
          {week.map((d) => (
            <li key={d.date} className="flex flex-col items-center gap-1">
              <span className="text-muted">{["S", "M", "T", "W", "T", "F", "S"][new Date(d.date + "T00:00:00Z").getUTCDay()]}</span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${d.state === "logged" ? "bg-accent text-white" : d.state === "nothing_today" ? "bg-accent/30" : d.future ? "border border-dashed border-line" : "bg-black/5 dark:bg-white/10"} ${d.isToday ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
                title={d.state ?? "No entry"}
              >
                {d.state === "logged" ? "✓" : d.state === "nothing_today" ? "–" : ""}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Server health">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Server last online</dt>
          <dd>
            {formatDateTime(heartbeat ? new Date(heartbeat) : null, tz)} {beatAge < 3 * 60_000 ? <Badge tone="good">Online</Badge> : <Badge tone="bad">Scheduler stalled</Badge>}
          </dd>
          <dt className="text-muted">Last reminder sent</dt>
          <dd>{formatDateTime(lastReminder ? new Date(lastReminder) : null, tz)}</dd>
          <dt className="text-muted">Last backup</dt>
          <dd>{formatDateTime(lastBackup ? new Date(lastBackup) : null, tz)}</dd>
        </dl>
      </Card>
    </Page>
  );
}
