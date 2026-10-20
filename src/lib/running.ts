import { prisma } from "./db";

/** Balance of each transaction's account right after that transaction (F4 running balance). */
export async function runningBalances(): Promise<Map<string, number>> {
  const accounts = await prisma.account.findMany({ select: { id: true, openingBalance: true } });
  const bal = new Map(accounts.map((a) => [a.id, a.openingBalance]));
  const rows = await prisma.transaction.findMany({
    where: { parentId: null },
    select: { id: true, accountId: true, amountOriginal: true, transferAccountId: true, transferAmount: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  // Key "txId:accountId" so a transfer has a balance on both sides.
  const out = new Map<string, number>();
  for (const r of rows) {
    const from = (bal.get(r.accountId) ?? 0) + r.amountOriginal;
    bal.set(r.accountId, from);
    out.set(`${r.id}:${r.accountId}`, from);
    if (r.transferAccountId) {
      const to = (bal.get(r.transferAccountId) ?? 0) + (r.transferAmount ?? 0);
      bal.set(r.transferAccountId, to);
      out.set(`${r.id}:${r.transferAccountId}`, to);
    }
  }
  return out;
}
