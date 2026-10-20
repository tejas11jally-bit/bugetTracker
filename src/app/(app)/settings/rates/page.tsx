import { prisma } from "@/lib/db";
import { getAllRates } from "@/lib/fx";
import { CURRENCIES, CURRENCY_CODES } from "@/lib/money";
import { formatDate, today } from "@/lib/dates";
import { Badge, Card, Page, btn, input } from "@/components/ui";
import { refreshRates, saveRate } from "@/app/actions/settings";

export default async function RatesPage() {
  const user = await prisma.user.findFirstOrThrow();
  const t = today(user.timezone);
  const rates = await getAllRates(t);
  return (
    <Page
      title="Exchange rates"
      subtitle="Fetched daily at 06:00. When offline, the last known rate is reused. Each transaction can also override its own rate."
      actions={
        <form action={refreshRates}>
          <button className={btn.secondary}>Fetch now</button>
        </form>
      }
    >
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-medium">Currency</th>
              <th className="py-1 text-right font-medium">AED per 1</th>
              <th className="py-1 text-right font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CURRENCY_CODES.filter((c) => c !== "AED").map((c) => {
              const r = rates[c];
              return (
                <tr key={c}>
                  <td className="py-1.5">
                    <strong>{c}</strong> <span className="text-muted">{CURRENCIES[c].name}</span>
                  </td>
                  <td className="tabular py-1.5 text-right">{r.rate.toFixed(4)}</td>
                  <td className="py-1.5 text-right">
                    {r.source === "fallback" ? <Badge tone="warn">Approximate</Badge> : <Badge tone={r.source === "manual" ? "accent" : "neutral"}>{`${r.source} ${r.date ? formatDate(r.date) : ""}`}</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title="Set a manual rate">
        <form action={saveRate} className="flex flex-wrap items-end gap-2">
          <select name="currency" className={`${input} w-28`} aria-label="Currency">
            {CURRENCY_CODES.filter((c) => c !== "AED").map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input name="rate" inputMode="decimal" placeholder="AED per 1" className={`${input} w-36`} aria-label="Rate" required />
          <input type="date" name="date" defaultValue={t} className={`${input} w-44`} aria-label="Date" />
          <button className={btn.primary}>Save</button>
        </form>
      </Card>
    </Page>
  );
}
