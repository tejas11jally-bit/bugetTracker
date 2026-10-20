import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { minorToInput, CURRENCY_CODES, formatAED } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, Field, Page, btn, input } from "@/components/ui";
import { duplicate, removeReceipt, removeTransaction, updateTransaction, uploadReceipt } from "@/app/actions/ledger";
import SplitEditor from "./split-editor";

const SOURCES: Record<string, string> = { manual: "Manual", apple_pay: "Apple Pay", quick_log: "Quick Log shortcut", recurring: "Recurring", import: "Import" };

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const tx = await prisma.transaction.findUnique({ where: { id }, include: { children: true, account: true } });
  if (!tx || tx.parentId) notFound();
  const [accounts, categories, user] = await Promise.all([
    prisma.account.findMany({ orderBy: { id: "asc" } }),
    prisma.category.findMany({ where: { OR: [{ archived: false }, { id: tx.categoryId ?? -1 }] }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }] }),
    prisma.user.findFirstOrThrow(),
  ]);
  const dest = accounts.find((a) => a.id === tx.transferAccountId);

  return (
    <Page
      title={tx.type === "transfer" ? "Transfer" : tx.payee || "Transaction"}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {SOURCES[tx.source] ?? tx.source} · added {formatDateTime(tx.createdAt, user.timezone)}
          {tx.status === "review" && <Badge tone="warn">Needs review</Badge>}
          {tx.cardLabel && <Badge>{tx.cardLabel}</Badge>}
        </span>
      }
      actions={
        <Link href="/transactions" className={btn.secondary}>
          Back
        </Link>
      }
    >
      <Card>
        <form action={updateTransaction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="id" value={tx.id} />
          <Field label="Type">
            <select name="type" defaultValue={tx.type} className={input}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
          </Field>
          <Field label="Date">
            <input type="date" name="date" defaultValue={tx.date} className={input} required />
          </Field>
          <Field label="Amount">
            <input name="amount" inputMode="decimal" defaultValue={minorToInput(Math.abs(tx.amountOriginal), tx.currency)} className={input} required />
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={tx.currency} className={input}>
              {CURRENCY_CODES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          {tx.currency !== "AED" && (
            <Field label={`Rate (AED per 1 ${tx.currency})`} hint={`= ${formatAED(Math.abs(tx.amountBase))} in budgets and reports`}>
              <input name="fxRate" inputMode="decimal" defaultValue={tx.fxRate.toFixed(6)} className={input} />
            </Field>
          )}
          <Field label={tx.type === "transfer" ? "From account" : "Account"}>
            <select name="accountId" defaultValue={tx.accountId} className={input}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </Field>
          {tx.type === "transfer" ? (
            <>
              <Field label="To account">
                <select name="transferAccountId" defaultValue={tx.transferAccountId ?? ""} className={input}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </Field>
              {dest && dest.currency !== tx.currency && (
                <Field label={`Amount received (${dest.currency})`}>
                  <input name="transferAmount" inputMode="decimal" defaultValue={minorToInput(tx.transferAmount ?? 0, dest.currency)} className={input} />
                </Field>
              )}
            </>
          ) : (
            !tx.split && (
              <Field label="Category">
                <select name="categoryId" defaultValue={tx.categoryId ?? ""} className={input}>
                  <option value="">Uncategorised</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )
          )}
          <div className="col-span-2">
            <Field label="Payee">
              <input name="payee" defaultValue={tx.payee} className={input} />
            </Field>
          </div>
          <Field label="Note">
            <input name="note" defaultValue={tx.note} className={input} />
          </Field>
          <Field label="Tags">
            <input name="tags" defaultValue={tx.tags} placeholder="work, trip" className={input} />
          </Field>
          <div className="col-span-2 flex flex-wrap gap-2">
            <button className={btn.primary}>Save</button>
            {tx.status === "review" && (
              <button name="confirm" value="1" className={btn.secondary}>
                Save and confirm
              </button>
            )}
          </div>
        </form>
      </Card>

      {tx.type !== "transfer" && (
        <Card title="Split across categories">
          <SplitEditor
            id={tx.id}
            currency={tx.currency}
            total={minorToInput(Math.abs(tx.amountOriginal), tx.currency)}
            categories={categories.map((c) => ({ id: c.id, name: `${c.icon} ${c.name}` }))}
            initial={
              tx.children.length
                ? tx.children.map((c) => ({ categoryId: c.categoryId ?? 0, amount: minorToInput(Math.abs(c.amountOriginal), tx.currency) }))
                : [{ categoryId: tx.categoryId ?? 0, amount: minorToInput(Math.abs(tx.amountOriginal), tx.currency) }]
            }
          />
        </Card>
      )}

      <Card title="Receipt">
        {tx.receiptPath ? (
          <div className="flex flex-col gap-3">
            {tx.receiptPath.endsWith(".pdf") || tx.receiptPath.endsWith(".heic") ? (
              <a href={`/api/receipts/${tx.id}`} className={btn.secondary} target="_blank">
                Open receipt
              </a>
            ) : (
              <a href={`/api/receipts/${tx.id}`} target="_blank">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, session-protected file */}
                <img src={`/api/receipts/${tx.id}`} alt="Receipt" className="max-h-96 rounded-xl border border-line" />
              </a>
            )}
            <form action={removeReceipt}>
              <input type="hidden" name="id" value={tx.id} />
              <button className={btn.danger}>Remove receipt</button>
            </form>
          </div>
        ) : (
          <form action={uploadReceipt} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={tx.id} />
            <input type="file" name="receipt" accept="image/*,application/pdf" capture="environment" className="text-sm" required />
            <button className={btn.secondary}>Attach</button>
          </form>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <form action={duplicate}>
          <input type="hidden" name="id" value={tx.id} />
          <button className={btn.secondary}>Duplicate to today</button>
        </form>
        <form action={removeTransaction}>
          <input type="hidden" name="id" value={tx.id} />
          <button className={btn.danger}>Delete</button>
        </form>
      </div>
    </Page>
  );
}
