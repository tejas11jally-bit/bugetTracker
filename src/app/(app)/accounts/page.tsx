import Link from "next/link";
import { prisma } from "@/lib/db";
import { accountBalancesAED } from "@/lib/ledger";
import { CURRENCY_CODES } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, Field, Money, Page, btn, input } from "@/components/ui";
import { saveAccount } from "@/app/actions/accounts";

const TYPE: Record<string, string> = { cash: "Cash", debit: "Debit", credit: "Credit card", savings: "Savings" };

export default async function AccountsPage() {
  const user = await prisma.user.findFirstOrThrow();
  const rows = await accountBalancesAED();
  const active = rows.filter((r) => !r.account.archived);
  const assets = active.filter((r) => r.balanceAED >= 0).reduce((s, r) => s + r.balanceAED, 0);
  const liabilities = active.filter((r) => r.balanceAED < 0).reduce((s, r) => s - r.balanceAED, 0);

  return (
    <Page title="Accounts" actions={<Link href="/reports?tab=networth" className={btn.secondary}>Net worth trend</Link>}>
      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted">Assets</p>
            <Money amount={assets} className="font-semibold" />
          </div>
          <div>
            <p className="text-xs text-muted">Liabilities</p>
            <Money amount={liabilities} className="font-semibold" />
          </div>
          <div>
            <p className="text-xs text-muted">Net worth</p>
            <Money amount={assets - liabilities} className="font-bold" />
          </div>
        </div>
      </Card>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.map(({ account: a, balance, balanceAED }) => (
          <li key={a.id}>
            <Link href={`/accounts/${a.id}`} className={`flex items-center gap-3 px-4 py-3 ${a.archived ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {a.name} <Badge>{TYPE[a.type]}</Badge> {a.archived && <Badge>Archived</Badge>}
                </p>
                <p className="text-xs text-muted">
                  {a.reconciledAt ? `Reconciled ${formatDateTime(a.reconciledAt, user.timezone)}` : "Never reconciled"}
                  {a.reconcileGapBp != null && ` · gap ${(a.reconcileGapBp / 100).toFixed(2)}%`}
                  {a.type === "credit" && a.dueDay && ` · due day ${a.dueDay}`}
                </p>
              </div>
              <div className="text-right">
                <Money amount={balance} currency={a.currency} className="font-semibold" colour={balance < 0} />
                {a.currency !== "AED" && (
                  <p className="text-xs text-muted">
                    <Money amount={balanceAED} />
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Card title="Add an account">
        <form action={saveAccount} className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input name="name" required className={input} placeholder="Emirates NBD debit" />
          </Field>
          <Field label="Type">
            <select name="type" className={input}>
              {Object.entries(TYPE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue="AED" className={input}>
              {CURRENCY_CODES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Opening balance" hint="Credit card: amount owed">
            <input name="openingBalance" inputMode="decimal" placeholder="0.00" className={input} />
          </Field>
          <Field label="Statement day (credit)">
            <input name="statementDay" type="number" min={1} max={31} className={input} />
          </Field>
          <Field label="Due day (credit)">
            <input name="dueDay" type="number" min={1} max={31} className={input} />
          </Field>
          <div className="col-span-2">
            <button className={btn.primary}>Add account</button>
          </div>
        </form>
      </Card>
    </Page>
  );
}
