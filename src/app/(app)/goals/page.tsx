import { prisma } from "@/lib/db";
import { today, formatDate } from "@/lib/dates";
import { GOAL_TEMPLATES, goalProgress, templateFor } from "@/lib/goals";
import { accountBalancesAED } from "@/lib/ledger";
import { minorToInput } from "@/lib/money";
import { Card, Empty, Field, Money, Page, Progress, Tabs, btn, input } from "@/components/ui";
import { archiveGoal, contribute, saveGoal } from "@/app/actions/bills";

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ template?: string; edit?: string }> }) {
  const sp = await searchParams;
  const user = await prisma.user.findFirstOrThrow();
  const t = today(user.timezone);
  const [goals, accounts, balances] = await Promise.all([
    prisma.goal.findMany({ where: { archived: false }, orderBy: { createdAt: "asc" } }),
    prisma.account.findMany({ where: { archived: false } }),
    accountBalancesAED(),
  ]);
  const tpl = templateFor(sp.template ?? "");
  const editing = goals.find((g) => g.id === Number(sp.edit));
  const defaultDate = (months: number) => {
    const d = new Date(t + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().slice(0, 10);
  };

  return (
    <Page title="Bills & goals">
      <Tabs
        current="goals"
        items={[
          { key: "bills", href: "/bills", label: "Bills & income" },
          { key: "goals", href: "/goals", label: "Goals" },
        ]}
      />
      {(tpl || sp.template === "custom" || editing) && (
        <Card title={editing ? `Edit ${editing.name}` : `New goal${tpl ? `: ${tpl.name}` : ""}`}>
          <form action={saveGoal} id="form" className="grid grid-cols-2 gap-3">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="templateKey" value={editing?.templateKey ?? tpl?.key ?? "custom"} />
            <Field label="Name">
              <input name="name" defaultValue={editing?.name ?? tpl?.name ?? ""} required className={input} />
            </Field>
            <Field label="Target (AED)">
              <input name="targetAmount" inputMode="decimal" required defaultValue={editing ? minorToInput(editing.targetAmount, "AED") : (tpl?.suggested ?? "")} className={input} />
            </Field>
            <Field label="Target date">
              <input name="targetDate" type="date" defaultValue={editing?.targetDate ?? defaultDate(tpl?.months ?? 12)} className={input} />
            </Field>
            <Field label="Track an account (optional)">
              <select name="linkedAccountId" defaultValue={editing?.linkedAccountId ?? ""} className={input}>
                <option value="">No, I&apos;ll add contributions</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Already saved (AED)">
              <input name="savedAmount" inputMode="decimal" defaultValue={editing ? minorToInput(editing.savedAmount, "AED") : ""} className={input} />
            </Field>
            <div className="col-span-2">
              <button className={btn.primary}>{editing ? "Save" : "Create goal"}</button>
            </div>
          </form>
        </Card>
      )}
      {goals.length === 0 && <Empty>No goals yet. Pick a template below.</Empty>}
      <div className="grid gap-4 sm:grid-cols-2">
        {goals.map((g) => {
          const linked = balances.find((b) => b.account.id === g.linkedAccountId);
          // A linked credit card goal tracks paying the balance down to zero.
          const saved = linked ? (linked.account.type === "credit" ? Math.max(g.targetAmount + linked.balanceAED, 0) : Math.max(linked.balanceAED, 0)) : g.savedAmount;
          const p = goalProgress(g, saved, t);
          const tp = templateFor(g.templateKey);
          return (
            <Card key={g.id} title={`${tp?.icon ?? "🎯"} ${g.name}`}>
              <p className="text-2xl font-bold">
                <Money amount={saved} /> <span className="text-sm font-normal text-muted">of <Money amount={g.targetAmount} /></span>
              </p>
              <div className="my-2">
                <Progress value={saved} max={g.targetAmount} />
              </div>
              <p className="text-sm text-muted">
                {p.done ? "Goal reached 🎉" : p.monthly != null ? (
                  <>
                    <Money amount={p.monthly} /> a month for {p.monthsLeft} month{p.monthsLeft === 1 ? "" : "s"} to reach it by {formatDate(g.targetDate!)}.
                  </>
                ) : (
                  <>
                    <Money amount={p.remaining} /> to go.
                  </>
                )}
              </p>
              {linked && <p className="mt-1 text-xs text-muted">Tracks {linked.account.name}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {!linked && (
                  <form action={contribute} className="flex gap-1">
                    <input type="hidden" name="id" value={g.id} />
                    <input name="amount" inputMode="decimal" placeholder="Add AED" className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" aria-label="Contribution" />
                    <button className={btn.ghost}>Add</button>
                  </form>
                )}
                <a href={`/goals?edit=${g.id}`} className={btn.ghost}>
                  Edit
                </a>
                <form action={archiveGoal}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className={btn.ghost}>Archive</button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Start from a template">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GOAL_TEMPLATES.map((g) => (
            <a key={g.key} href={`/goals?template=${g.key}`} className={`rounded-xl border p-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 ${sp.template === g.key ? "border-accent" : "border-line"}`}>
              <span className="text-xl">{g.icon}</span>
              <span className="mt-1 block font-medium">{g.name}</span>
              <span className="block text-xs text-muted">{g.hint}</span>
            </a>
          ))}
          <a href="/goals?template=custom" className="rounded-xl border border-dashed border-line p-3 text-sm">
            <span className="text-xl">🎯</span>
            <span className="mt-1 block font-medium">Custom goal</span>
          </a>
        </div>
      </Card>

    </Page>
  );
}
