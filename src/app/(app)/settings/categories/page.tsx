import { prisma } from "@/lib/db";
import { CATEGORY_GROUPS } from "@/lib/seed";
import { Badge, Card, Page, btn } from "@/components/ui";
import { saveCategory } from "@/app/actions/settings";

const cell = "rounded-lg border border-line bg-surface px-2 py-1.5 text-sm";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ orderBy: [{ archived: "asc" }, { sortOrder: "asc" }] });
  return (
    <Page title="Categories">
      {CATEGORY_GROUPS.map((g) => (
        <Card key={g} title={g}>
          <ul className="flex flex-col gap-2">
            {categories
              .filter((c) => c.group === g)
              .map((c) => (
                <li key={c.id}>
                  <form action={saveCategory} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="icon" defaultValue={c.icon} className={`${cell} w-12 text-center`} aria-label="Icon" />
                    <input name="name" defaultValue={c.name} className={`${cell} min-w-0 flex-1`} aria-label="Name" />
                    <select name="group" defaultValue={c.group} className={cell} aria-label="Group">
                      {CATEGORY_GROUPS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                    <input type="color" name="colour" defaultValue={c.colour} className="h-8 w-10 rounded" aria-label="Colour" />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="archived" defaultChecked={c.archived} /> Archived
                    </label>
                    <button className={btn.ghost}>Save</button>
                    {c.archived && <Badge>Hidden</Badge>}
                  </form>
                </li>
              ))}
          </ul>
        </Card>
      ))}
      <Card title="Add a category">
        <form action={saveCategory} className="flex flex-wrap items-center gap-2">
          <input name="icon" placeholder="🙂" className={`${cell} w-12 text-center`} aria-label="Icon" />
          <input name="name" placeholder="Name" required className={`${cell} min-w-0 flex-1`} aria-label="Name" />
          <select name="group" defaultValue="Lifestyle" className={cell} aria-label="Group">
            {CATEGORY_GROUPS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input type="color" name="colour" defaultValue="#64748b" className="h-8 w-10 rounded" aria-label="Colour" />
          <button className={btn.primary}>Add</button>
        </form>
      </Card>
    </Page>
  );
}
