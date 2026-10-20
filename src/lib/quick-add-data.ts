import { prisma } from "./db";
import { categoriesByRecent } from "./ledger";
import { today } from "./dates";
import type { QuickAddData } from "@/components/quick-add";

export async function quickAddData(): Promise<QuickAddData> {
  const user = await prisma.user.findFirstOrThrow();
  const { categories, recentIds } = await categoriesByRecent();
  const accounts = await prisma.account.findMany({ where: { archived: false }, orderBy: { id: "asc" } });
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, group: c.group })),
    recentIds,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency, type: a.type })),
    defaultAccountId: user.lastAccountId,
    today: today(user.timezone),
  };
}
