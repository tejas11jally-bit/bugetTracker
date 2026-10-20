import { prisma } from "@/lib/db";
import { Card, Empty, Page, btn } from "@/components/ui";
import { deleteRule, saveRule } from "@/app/actions/settings";

const cell = "rounded-lg border border-line bg-surface px-2 py-1.5 text-sm";

export default async function RulesPage() {
  const [rules, categories] = await Promise.all([
    prisma.merchantRule.findMany({ include: { category: true }, orderBy: [{ hitCount: "desc" }, { matchText: "asc" }] }),
    prisma.category.findMany({ where: { archived: false }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }] }),
  ]);
  const options = categories.map((c) => (
    <option key={c.id} value={c.id}>
      {c.icon} {c.name}
    </option>
  ));
  return (
    <Page title="Merchant rules" subtitle="Ledgerly learns these when you set or correct a category. Apple Pay purchases use them to pre-fill the category.">
      <Card title="Add a rule">
        <form action={saveRule} className="flex flex-wrap gap-2">
          <input name="matchText" placeholder="Merchant contains… (e.g. carrefour)" required className={`${cell} min-w-0 flex-1`} aria-label="Merchant text" />
          <select name="categoryId" className={cell} aria-label="Category">
            {options}
          </select>
          <button className={btn.primary}>Add</button>
        </form>
      </Card>
      {rules.length === 0 ? (
        <Empty>No rules yet.</Empty>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rules.map((r) => (
              <li key={r.id} className="py-2">
                <form action={saveRule} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="matchText" defaultValue={r.matchText} className={`${cell} min-w-0 flex-1`} aria-label="Merchant text" />
                  <select name="categoryId" defaultValue={r.categoryId} className={cell} aria-label="Category">
                    {options}
                  </select>
                  <span className="text-xs text-muted">×{r.hitCount}</span>
                  <button className={btn.ghost}>Save</button>
                  <button formAction={deleteRule} className={btn.ghost}>
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
