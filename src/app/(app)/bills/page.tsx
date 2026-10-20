import { prisma } from "@/lib/db";
import { addDays, addMonths, currentMonth, daysInMonth, dayOfWeek, formatDate, formatMonth, today } from "@/lib/dates";
import { occurrences, upcoming, CADENCES } from "@/lib/recurring";
import { CURRENCY_CODES, minorToInput } from "@/lib/money";
import { Badge, Card, Empty, Field, Money, Page, Tabs, btn, input } from "@/components/ui";
import { archiveRecurring, paid, saveRecurring, skipOnce } from "@/app/actions/bills";
import Link from "next/link";
import ScrollTo from "@/components/scroll-to";

type SP = { view?: string; month?: string; focus?: string; edit?: string };

export default async function BillsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await prisma.user.findFirstOrThrow();
  const t = today(user.timezone);
  const view = sp.view === "calendar" ? "calendar" : "list";
  const focus = Number(sp.focus) || null;
  const [items, accounts, categories, soon] = await Promise.all([
    prisma.recurringItem.findMany({ where: { archived: false }, include: { account: true, category: true }, orderBy: { nextDueDate: "asc" } }),
    prisma.account.findMany({ where: { archived: false }, orderBy: { id: "asc" } }),
    prisma.category.findMany({ where: { archived: false }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }] }),
    upcoming(t, 30),
  ]);
  const editing = items.find((i) => i.id === Number(sp.edit));

  return (
    <Page title="Bills & goals">
      <Tabs
        current="bills"
        items={[
          { key: "bills", href: "/bills", label: "Bills & income" },
          { key: "goals", href: "/goals", label: "Goals" },
        ]}
      />
      <div className="flex gap-2">
        <Link href="/bills" className={view === "list" ? btn.primary : btn.secondary}>
          List
        </Link>
        <Link href="/bills?view=calendar" className={view === "calendar" ? btn.primary : btn.secondary}>
          Calendar
        </Link>
      </div>

      {view === "calendar" ? (
        <Calendar month={/^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth(user.timezone)} items={items} todayDate={t} weekStart={user.weekStart} />
      ) : (
        <Card title="Next 30 days">
          {soon.length === 0 ? (
            <Empty>No bills or income due. Add one below.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {soon.map(({ item, date, overdue }) => {
                const isNext = date === item.nextDueDate;
                return (
                  <li key={`${item.id}-${date}`} id={`bill-${item.id}`} className={`flex flex-wrap items-center gap-3 py-3 ${focus === item.id && isNext ? "rounded-xl bg-accent/10 px-2" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {item.category?.icon} {item.name} {item.autoPost && <Badge>Auto-post</Badge>} {overdue && <Badge tone="bad">Overdue</Badge>}
                        {date === t && <Badge tone="warn">Today</Badge>}
                        {date === addDays(t, 1) && <Badge tone="warn">Tomorrow</Badge>}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(date)} · {item.cadence === "custom" ? `every ${item.interval} days` : item.cadence} · {item.account.name}
                      </p>
                    </div>
                    <Money amount={item.amount} currency={item.currency} colour className="font-semibold" />
                    {isNext && (
                      <div className="flex gap-1">
                        <form action={paid}>
                          <input type="hidden" name="id" value={item.id} />
                          <button className={btn.primary}>{item.amount < 0 ? "Mark paid" : "Received"}</button>
                        </form>
                        <form action={skipOnce}>
                          <input type="hidden" name="id" value={item.id} />
                          <button className={btn.ghost}>Skip</button>
                        </form>
                        <Link href={`/bills?edit=${item.id}`} className={btn.ghost}>
                          Edit
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {focus && <ScrollTo id={`bill-${focus}`} />}
      {editing && <ScrollTo id="form" />}
      <Card title={editing ? `Edit ${editing.name}` : "Add a bill or income"}>
        <form action={saveRecurring} id="form" className="grid grid-cols-2 gap-3" key={editing?.id ?? "new"}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <Field label="Name">
            <input name="name" defaultValue={editing?.name} required className={input} placeholder="Rent, DEWA, Salary" />
          </Field>
          <Field label="Kind">
            <select name="kind" defaultValue={editing && editing.amount > 0 ? "income" : "bill"} className={input}>
              <option value="bill">Bill (money out)</option>
              <option value="income">Income (money in)</option>
            </select>
          </Field>
          <Field label="Amount">
            <input name="amount" inputMode="decimal" required defaultValue={editing ? minorToInput(Math.abs(editing.amount), editing.currency) : ""} className={input} />
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={editing?.currency ?? "AED"} className={input}>
              {CURRENCY_CODES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Repeats">
            <select name="cadence" defaultValue={editing?.cadence ?? "monthly"} className={input}>
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Custom: every N days">
            <input name="interval" type="number" min={1} defaultValue={editing?.interval ?? 1} className={input} />
          </Field>
          <Field label="Next due date">
            <input name="nextDueDate" type="date" required defaultValue={editing?.nextDueDate ?? t} className={input} />
          </Field>
          <Field label="Account">
            <select name="accountId" defaultValue={editing?.accountId} className={input}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select name="categoryId" defaultValue={editing?.categoryId ?? ""} className={input}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <input type="checkbox" name="autoPost" defaultChecked={editing?.autoPost} className="h-4 w-4" /> Auto-post on due date (with a notification)
          </label>
          <div className="col-span-2 flex gap-2">
            <button className={btn.primary}>{editing ? "Save" : "Add"}</button>
            {editing && (
              <>
                <Link href="/bills" className={btn.secondary}>
                  Cancel
                </Link>
                <button formAction={archiveRecurring} name="id" value={editing.id} className={btn.danger}>
                  Delete
                </button>
              </>
            )}
          </div>
        </form>
      </Card>
    </Page>
  );
}

function Calendar({ month, items, todayDate, weekStart }: { month: string; items: Awaited<ReturnType<typeof prisma.recurringItem.findMany>>; todayDate: string; weekStart: number }) {
  const first = `${month}-01`;
  const days = daysInMonth(month);
  const lead = (dayOfWeek(first) - weekStart + 7) % 7;
  const byDate = new Map<string, typeof items>();
  for (const item of items) for (const d of occurrences(item, first, `${month}-${String(days).padStart(2, "0")}`)) byDate.set(d, [...(byDate.get(d) ?? []), item]);
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const headers = Array.from({ length: 7 }, (_, i) => names[(i + weekStart) % 7]);
  return (
    <Card
      title={formatMonth(month)}
      action={
        <span className="flex gap-1">
          <Link href={`/bills?view=calendar&month=${addMonths(month, -1)}`} className={btn.ghost} aria-label="Previous month">
            ←
          </Link>
          <Link href={`/bills?view=calendar&month=${addMonths(month, 1)}`} className={btn.ghost} aria-label="Next month">
            →
          </Link>
        </span>
      }
    >
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {headers.map((h) => (
          <div key={h} className="py-1 font-semibold text-muted">
            {h}
          </div>
        ))}
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`l${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, "0")}`;
          const due = byDate.get(d) ?? [];
          return (
            <div key={d} className={`min-h-16 rounded-lg border p-1 text-left ${d === todayDate ? "border-accent" : "border-line"}`}>
              <div className="text-[11px] text-muted">{i + 1}</div>
              {due.map((it) => (
                <Link key={it.id} href={`/bills?focus=${it.id}`} className={`mt-0.5 block truncate rounded px-1 text-[10px] ${it.amount < 0 ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"}`}>
                  {it.name}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
