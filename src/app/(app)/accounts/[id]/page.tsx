import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { accountBalances } from "@/lib/ledger";
import { CURRENCY_CODES, minorToInput } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Card, Field, Money, Page, btn, input } from "@/components/ui";
import { saveAccount } from "@/app/actions/accounts";
import Reconcile from "./reconcile";

export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reconciled?: string }> }) {
  const id = Number((await params).id);
  const { reconciled } = await searchParams;
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) notFound();
  const user = await prisma.user.findFirstOrThrow();
  const balance = (await accountBalances()).get(id) ?? 0;
  const credit = account.type === "credit";

  return (
    <Page
      title={account.name}
      subtitle={`${account.currency} · ${account.type}`}
      actions={
        <Link href={`/transactions?account=${id}`} className={btn.secondary}>
          Transactions
        </Link>
      }
    >
      <Card>
        <p className="text-sm text-muted">{credit ? "Owed" : "Balance"}</p>
        <p className="text-3xl font-bold">
          <Money amount={credit ? -balance : balance} currency={account.currency} />
        </p>
      </Card>
      <Card title="Reconcile">
        {reconciled && account.reconcileGapBp != null && (
          <p className="mb-3 rounded-xl bg-accent/10 p-3 text-sm">
            Reconciled. Gap was {(account.reconcileGapBp / 100).toFixed(2)}% {account.reconcileGapBp < 200 ? "(under the 2% target)" : "(above the 2% target)"}.
          </p>
        )}
        <p className="mb-3 text-sm text-muted">
          Enter the balance your bank shows. Last reconciled: {formatDateTime(account.reconciledAt, user.timezone)}.
        </p>
        <Reconcile accountId={id} appBalance={balance} currency={account.currency} credit={credit} />
      </Card>
      <Card title="Edit account">
        <form action={saveAccount} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="id" value={id} />
          <Field label="Name">
            <input name="name" defaultValue={account.name} required className={input} />
          </Field>
          <Field label="Type">
            <select name="type" defaultValue={account.type} className={input}>
              <option value="cash">Cash</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit card</option>
              <option value="savings">Savings</option>
            </select>
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={account.currency} className={input}>
              {CURRENCY_CODES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label={credit ? "Opening amount owed" : "Opening balance"}>
            <input name="openingBalance" inputMode="decimal" defaultValue={minorToInput(credit ? -account.openingBalance : account.openingBalance, account.currency)} className={input} />
          </Field>
          <Field label="Statement day (credit)">
            <input name="statementDay" type="number" min={1} max={31} defaultValue={account.statementDay ?? ""} className={input} />
          </Field>
          <Field label="Due day (credit)">
            <input name="dueDay" type="number" min={1} max={31} defaultValue={account.dueDay ?? ""} className={input} />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="archived" defaultChecked={account.archived} className="h-4 w-4" /> Archived (hidden from quick add)
          </label>
          <div className="col-span-2">
            <button className={btn.primary}>Save</button>
          </div>
        </form>
      </Card>
    </Page>
  );
}
