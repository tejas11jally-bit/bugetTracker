import Link from "next/link";
import { prisma } from "@/lib/db";
import { addDays, currentMonth, formatDate, formatMonth, lastDayOfMonth, shortMonth, today } from "@/lib/dates";
import { budgetPerformance, categoryTrends, forecast, monthlyCashFlow, netWorth, payeeRanking, spendingByCategory, spendingByPaymentMethod } from "@/lib/reports";
import { formatAED, formatMoney, toMinor } from "@/lib/money";
import { BarChart, HBars, LineChart } from "@/components/charts";
import { Badge, Card, Empty, Money, Page, Tabs, btn, input } from "@/components/ui";
import { saveForecastThreshold } from "@/app/actions/reports";

const TABS = [
  { key: "spending", label: "Spending" },
  { key: "trends", label: "Trends" },
  { key: "cashflow", label: "Cash flow" },
  { key: "budget", label: "Budget performance" },
  { key: "networth", label: "Net worth" },
  { key: "forecast", label: "Forecast" },
];

type SP = { tab?: string; from?: string; to?: string; month?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await prisma.user.findFirstOrThrow();
  const tz = user.timezone;
  const t = today(tz);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth(tz);
  const from = sp.from || `${month}-01`;
  const to = sp.to || (month === currentMonth(tz) ? t : lastDayOfMonth(month));
  const tab = TABS.find((x) => x.key === sp.tab)?.key ?? "spending";

  return (
    <Page
      title="Reports"
      actions={
        <a href="/api/export/csv" className={btn.secondary}>
          Export CSV
        </a>
      }
    >
      <Tabs current={tab} items={TABS.map((x) => ({ key: x.key, label: x.label, href: `/reports?tab=${x.key}` }))} />
      {tab === "spending" && <Spending from={from} to={to} />}
      {tab === "trends" && <Trends month={month} />}
      {tab === "cashflow" && <CashFlow month={month} />}
      {tab === "budget" && <BudgetPerf month={month} />}
      {tab === "networth" && <NetWorth month={month} t={t} />}
      {tab === "forecast" && <Forecast t={t} threshold={user.forecastThreshold} />}
    </Page>
  );
}

async function Spending({ from, to }: { from: string; to: string }) {
  const [cats, payees, methods] = await Promise.all([spendingByCategory(from, to), payeeRanking(from, to), spendingByPaymentMethod(from, to)]);
  const total = cats.reduce((s, c) => s + c.total, 0);
  return (
    <>
      <form className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="spending" />
        <label className="text-sm">
          <span className="text-muted">From</span>
          <input type="date" name="from" defaultValue={from} className={input} />
        </label>
        <label className="text-sm">
          <span className="text-muted">To</span>
          <input type="date" name="to" defaultValue={to} className={input} />
        </label>
        <button className={btn.primary}>Apply</button>
      </form>
      <Card title={`By category · ${formatDate(from)} – ${formatDate(to)}`} action={<Money amount={total} className="font-semibold" />}>
        {cats.length ? (
          <HBars rows={cats.map((c) => ({ label: `${c.icon} ${c.name}`, value: c.total, colour: c.colour, sub: total ? `${Math.round((c.total / total) * 100)}%` : undefined }))} />
        ) : (
          <Empty>No spending in this range.</Empty>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Top payees">
          {payees.length ? <HBars rows={payees.map((p) => ({ label: p.payee, value: p.total, sub: `×${p.count}` }))} /> : <Empty>No payees yet.</Empty>}
        </Card>
        <Card title="By payment method">
          {methods.length ? <HBars rows={methods.map((m) => ({ label: m.label, value: m.total }))} /> : <Empty>No spending yet.</Empty>}
        </Card>
      </div>
    </>
  );
}

async function Trends({ month }: { month: string }) {
  const [flow, trends] = await Promise.all([monthlyCashFlow(month, 12), categoryTrends(month)]);
  return (
    <>
      <Card title="12-month spending">
        <BarChart labels={flow.map((f) => shortMonth(f.month))} series={[{ label: "Spending", values: flow.map((f) => f.expense), colour: "var(--accent)" }]} />
      </Card>
      <Card title={`Categories in ${formatMonth(month)} vs 3-month average`}>
        {trends.length === 0 ? (
          <Empty>Not enough history yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1 font-medium">Category</th>
                <th className="py-1 text-right font-medium">This month</th>
                <th className="py-1 text-right font-medium">3-mo avg</th>
                <th className="py-1 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {trends.map((r) => (
                <tr key={String(r.categoryId)}>
                  <td className="py-1.5">{r.name}</td>
                  <td className="tabular py-1.5 text-right">{formatAED(r.current)}</td>
                  <td className="tabular py-1.5 text-right text-muted">{formatAED(r.average)}</td>
                  <td className="py-1.5 text-right">{r.change == null ? "–" : <Badge tone={r.change > 10 ? "bad" : r.change < -10 ? "good" : "neutral"}>{r.change > 0 ? "+" : ""}{r.change}%</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

async function CashFlow({ month }: { month: string }) {
  const flow = await monthlyCashFlow(month, 12);
  return (
    <>
      <Card title="Income vs expense">
        <BarChart
          labels={flow.map((f) => shortMonth(f.month))}
          series={[
            { label: "Income", values: flow.map((f) => f.income), colour: "#16a34a" },
            { label: "Expense", values: flow.map((f) => f.expense), colour: "#dc2626" },
          ]}
        />
      </Card>
      <Card title="Cash flow by month">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-medium">Month</th>
              <th className="py-1 text-right font-medium">In</th>
              <th className="py-1 text-right font-medium">Out</th>
              <th className="py-1 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...flow].reverse().map((f) => (
              <tr key={f.month}>
                <td className="py-1.5">{formatMonth(f.month)}</td>
                <td className="tabular py-1.5 text-right">{formatAED(f.income)}</td>
                <td className="tabular py-1.5 text-right">{formatAED(f.expense)}</td>
                <td className={`tabular py-1.5 text-right font-medium ${f.net < 0 ? "text-red-700 dark:text-red-400" : ""}`}>{formatAED(f.net, { sign: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

async function BudgetPerf({ month }: { month: string }) {
  const perf = await budgetPerformance(month, 6);
  return (
    <>
      <Card title="Assigned vs spent">
        <BarChart
          labels={perf.map((p) => shortMonth(p.month))}
          series={[
            { label: "Assigned", values: perf.map((p) => p.assigned), colour: "#94a3b8" },
            { label: "Spent", values: perf.map((p) => p.spent), colour: "var(--accent)" },
          ]}
        />
      </Card>
      <Card title="Categories within budget (target 80%+)">
        <ul className="divide-y divide-line text-sm">
          {[...perf].reverse().map((p) => {
            const pct = p.categories ? Math.round((p.within / p.categories) * 100) : null;
            return (
              <li key={p.month} className="flex justify-between py-2">
                <span>{formatMonth(p.month)}</span>
                <span>{pct == null ? <span className="text-muted">No budget</span> : <Badge tone={pct >= 80 ? "good" : "warn"}>{`${p.within}/${p.categories} · ${pct}%`}</Badge>}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

async function NetWorth({ month, t }: { month: string; t: string }) {
  const nw = await netWorth(month, t);
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["Assets", nw.current.assets],
            ["Liabilities", nw.current.liabilities],
            ["Net worth", nw.current.net],
          ] as const
        ).map(([l, v]) => (
          <Card key={l}>
            <p className="text-xs text-muted">{l}</p>
            <Money amount={v} className="text-lg font-bold" />
          </Card>
        ))}
      </div>
      <Card title="Net worth, last 12 months">
        <LineChart labels={nw.trend.map((p) => shortMonth(p.month))} series={[{ label: "Net worth", values: nw.trend.map((p) => p.net), colour: "var(--accent)" }]} />
      </Card>
      <Card title="Accounts">
        <ul className="divide-y divide-line text-sm">
          {nw.accounts
            .filter((a) => !a.account.archived)
            .map((a) => (
              <li key={a.account.id} className="flex justify-between py-2">
                <Link href={`/accounts/${a.account.id}`}>{a.account.name}</Link>
                <Money amount={a.balanceAED} colour={a.balanceAED < 0} />
              </li>
            ))}
        </ul>
      </Card>
    </>
  );
}

async function Forecast({ t, threshold }: { t: string; threshold: number }) {
  const rows = await forecast(t, 90);
  const labels = Array.from({ length: 91 }, (_, i) => {
    const d = addDays(t, i);
    return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  });
  return (
    <>
      <Card title="Low-balance warning">
        <form action={saveForecastThreshold} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="text-muted">Warn below (AED)</span>
            <input name="threshold" inputMode="decimal" defaultValue={(threshold / 100).toFixed(0)} className={input} />
          </label>
          <button className={btn.secondary}>Save</button>
        </form>
        <p className="mt-2 text-xs text-muted">Projection = today&apos;s balance plus recurring bills and income. Add bills under Bills &amp; goals to improve it.</p>
      </Card>
      {rows.length === 0 && <Empty>No accounts yet.</Empty>}
      {rows.map((r) => {
        const low = r.minAED < threshold;
        const thresholdLocal = toMinor(String(threshold / 100 / r.rate), r.account.currency) ?? 0;
        return (
          <Card
            key={r.account.id}
            title={r.account.name}
            action={low ? <Badge tone="bad">Dips to {formatMoney(r.min, r.account.currency)}</Badge> : <Badge tone="good">Lowest {formatMoney(r.min, r.account.currency)}</Badge>}
          >
            <LineChart labels={labels} series={[{ label: r.account.name, values: r.points.map((p) => p.balance), colour: low ? "#dc2626" : "var(--accent)" }]} threshold={r.account.type === "credit" ? undefined : thresholdLocal} />
          </Card>
        );
      })}
    </>
  );
}
