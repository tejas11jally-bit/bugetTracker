import { prisma } from "./db";

// Full JSON backup and restore (F17). Device-specific rows (push subscriptions, passkeys) are not included.
export const BACKUP_VERSION = 1;

export async function exportAll() {
  const [users, accounts, categories, transactions, budgets, recurringItems, goals, reminders, checkins, fxRates, merchantRules, apiTokens] = await Promise.all([
    prisma.user.findMany(),
    prisma.account.findMany(),
    prisma.category.findMany(),
    prisma.transaction.findMany({ orderBy: { id: "asc" } }),
    prisma.budget.findMany(),
    prisma.recurringItem.findMany(),
    prisma.goal.findMany(),
    prisma.reminder.findMany(),
    prisma.checkin.findMany(),
    prisma.fxRate.findMany(),
    prisma.merchantRule.findMany(),
    prisma.apiToken.findMany(),
  ]);
  return { app: "ledgerly", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables: { users, accounts, categories, transactions, budgets, recurringItems, goals, reminders, checkins, fxRates, merchantRules, apiTokens } };
}

type Backup = Awaited<ReturnType<typeof exportAll>>;

export async function restoreAll(data: Backup) {
  if (data?.app !== "ledgerly" || !data.tables) throw new Error("Not a Ledgerly backup file");
  const t = data.tables;
  // Children have parent_id → insert parents first.
  const parents = t.transactions.filter((x) => !x.parentId);
  const children = t.transactions.filter((x) => x.parentId);
  await prisma.$transaction([
    prisma.alert.deleteMany(),
    prisma.merchantRule.deleteMany(),
    prisma.transaction.deleteMany({ where: { parentId: { not: null } } }),
    prisma.transaction.deleteMany(),
    prisma.budget.deleteMany(),
    prisma.recurringItem.deleteMany(),
    prisma.goal.deleteMany(),
    prisma.account.deleteMany(),
    prisma.category.deleteMany(),
    prisma.reminder.deleteMany(),
    prisma.checkin.deleteMany(),
    prisma.fxRate.deleteMany(),
    prisma.apiToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.user.createMany({ data: t.users }),
    prisma.account.createMany({ data: t.accounts }),
    prisma.category.createMany({ data: t.categories }),
    prisma.transaction.createMany({ data: parents }),
    prisma.transaction.createMany({ data: children }),
    prisma.budget.createMany({ data: t.budgets }),
    prisma.recurringItem.createMany({ data: t.recurringItems }),
    prisma.goal.createMany({ data: t.goals }),
    prisma.reminder.createMany({ data: t.reminders }),
    prisma.checkin.createMany({ data: t.checkins }),
    prisma.fxRate.createMany({ data: t.fxRates }),
    prisma.merchantRule.createMany({ data: t.merchantRules }),
    prisma.apiToken.createMany({ data: t.apiTokens }),
  ]);
  return { transactions: t.transactions.length, accounts: t.accounts.length };
}
