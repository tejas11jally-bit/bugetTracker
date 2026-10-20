import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runningBalances } from "@/lib/running";
import { formatDate } from "@/lib/dates";
import { Badge, Empty, Money, Page, btn, input } from "@/components/ui";
import { bulkRecategorise } from "@/app/actions/ledger";

type Search = { q?: string; from?: string; to?: string; category?: string; account?: string; tag?: string; status?: string; limit?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const limit = Math.min(Number(sp.limit) || 100, 2000);
  const accountId = Number(sp.account) || undefined;
  const categoryId = sp.category === "none" ? null : Number(sp.category) || undefined;

  const where: Prisma.TransactionWhereInput = { parentId: null };
  const and: Prisma.TransactionWhereInput[] = [];
  if (sp.q) and.push({ OR: [{ payee: { contains: sp.q } }, { note: { contains: sp.q } }, { tags: { contains: sp.q.toLowerCase() } }] });
  if (sp.from) and.push({ date: { gte: sp.from } });
  if (sp.to) and.push({ date: { lte: sp.to } });
  if (accountId) and.push({ OR: [{ accountId }, { transferAccountId: accountId }] });
  if (categoryId !== undefined) and.push({ OR: [{ categoryId }, { children: { some: { categoryId: categoryId ?? undefined } } }] });
  if (sp.tag) and.push({ tags: { contains: sp.tag.toLowerCase() } });
  if (sp.status) and.push({ status: sp.status });
  if (and.length) where.AND = and;

  const [rows, total, accounts, categories, running] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, account: true, transferAccount: true, children: { include: { category: true } } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: limit,
    }),
    prisma.transaction.count({ where }),
    prisma.account.findMany({ orderBy: { id: "asc" } }),
    prisma.category.findMany({ where: { archived: false }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }] }),
    runningBalances(),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const exportQs = new URLSearchParams(qs);
  exportQs.delete("limit");

  // Group by date for a compact list.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.date, [...(groups.get(r.date) ?? []), r]);

  return (
    <Page
      title="Transactions"
      subtitle={`${total} transaction${total === 1 ? "" : "s"}`}
      actions={
        <>
          <Link href="/review" className={btn.secondary}>
            Review queue
          </Link>
          <a href={`/api/export/csv?${exportQs}`} className={btn.secondary}>
            Export CSV
          </a>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-2 md:grid-cols-4" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search payee, note, tag" className={`${input} col-span-2`} aria-label="Search" />
        <select name="account" defaultValue={sp.account ?? ""} className={input} aria-label="Account">
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={sp.category ?? ""} className={input} aria-label="Category">
          <option value="">All categories</option>
          <option value="none">Uncategorised</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={sp.from} className={input} aria-label="From date" />
        <input type="date" name="to" defaultValue={sp.to} className={input} aria-label="To date" />
        <input name="tag" defaultValue={sp.tag} placeholder="Tag" className={input} aria-label="Tag" />
        <select name="status" defaultValue={sp.status ?? ""} className={input} aria-label="Status">
          <option value="">Any status</option>
          <option value="review">In review</option>
          <option value="confirmed">Confirmed</option>
        </select>
        <div className="col-span-2 flex gap-2 md:col-span-4">
          <button className={btn.primary}>Filter</button>
          <Link href="/transactions" className={btn.secondary}>
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <Empty>No transactions match. Tap + to log one.</Empty>
      ) : (
        <form action={bulkRecategorise} className="flex flex-col gap-3">
          <div className="sticky top-12 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/95 p-2 backdrop-blur md:top-2">
            <span className="text-sm text-muted">Selected →</span>
            <select name="categoryId" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" aria-label="New category">
              <option value="">Recategorise to…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
            <button className={btn.ghost}>Apply</button>
          </div>
          {[...groups.entries()].map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-1 px-1 text-xs font-semibold tracking-wide text-muted uppercase">{formatDate(date)}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {items.map((t) => {
                  const viewAcc = accountId && t.transferAccountId === accountId ? accountId : t.accountId;
                  const shown = accountId && t.transferAccountId === accountId ? (t.transferAmount ?? 0) : t.amountOriginal;
                  const currency = viewAcc === t.accountId ? t.currency : (t.transferAccount?.currency ?? t.currency);
                  const bal = running.get(`${t.id}:${viewAcc}`);
                  const accCurrency = viewAcc === t.accountId ? t.account.currency : (t.transferAccount?.currency ?? "AED");
                  const title = t.type === "transfer" ? `${t.account.name} → ${t.transferAccount?.name}` : t.payee || t.category?.name || (t.split ? "Split" : "Uncategorised");
                  const cat = t.split ? t.children.map((c) => c.category?.name).join(" + ") : t.type === "transfer" ? "Transfer" : (t.category?.name ?? "Uncategorised");
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                      <input type="checkbox" name="ids" value={t.id} className="h-4 w-4 shrink-0" aria-label={`Select ${title}`} disabled={t.split || t.type === "transfer"} />
                      <Link href={`/transactions/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: `${t.category?.colour ?? "#94a3b8"}22` }} aria-hidden>
                          {t.type === "transfer" ? "⇄" : t.split ? "✂" : (t.category?.icon ?? "•")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {title} {t.status === "review" && <Badge tone="warn">Review</Badge>} {t.receiptPath && <span aria-label="Has receipt">📎</span>}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {cat} · {t.account.name}
                            {t.tags && ` · ${t.tags.split(",").map((x) => `#${x}`).join(" ")}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <Money amount={shown} currency={currency} colour={t.type !== "transfer"} className="text-sm font-semibold" />
                          {t.currency !== "AED" && viewAcc === t.accountId && (
                            <span className="block text-xs text-muted">
                              <Money amount={t.amountBase} />
                            </span>
                          )}
                          {bal !== undefined && (
                            <span className="block text-[11px] text-muted">
                              Bal <Money amount={bal} currency={accCurrency} />
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </form>
      )}
      {total > rows.length && (
        <Link href={`/transactions?${new URLSearchParams({ ...Object.fromEntries(qs), limit: String(limit + 200) })}`} className={`${btn.secondary} self-center`}>
          Show more
        </Link>
      )}
    </Page>
  );
}
