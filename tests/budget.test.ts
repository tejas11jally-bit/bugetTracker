import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { computeBudget, setAssigned, setRolloverMode, moveMoney, copyLastMonth } from "@/lib/budget";
import { createTransaction } from "@/lib/ledger";

await prisma.user.create({ data: { name: "T", email: "t@x", passwordHash: "x" } });
const acc = await prisma.account.create({ data: { name: "Bank", type: "debit", currency: "AED" } });
const food = await prisma.category.create({ data: { name: "Food", group: "Essentials" } });
const fun = await prisma.category.create({ data: { name: "Fun", group: "Lifestyle" } });
const salary = await prisma.category.create({ data: { name: "Salary", group: "Income" } });
const tx = (date: string, amount: number, categoryId: number | null, currency = "AED", fxRate?: number) =>
  createTransaction({ accountId: acc.id, categoryId, date, currency, amount, type: amount > 0 ? "income" : "expense", fxRate, learn: false });

// September: income 10,000; assign Food 1,000 (carry), Fun 500 (reset). Spend Food 1,200 (over), Fun 300.
await tx("2026-09-01", 1_000_000, salary.id);
await setAssigned(food.id, "2026-09", 100_000);
await setAssigned(fun.id, "2026-09", 50_000);
await setRolloverMode(fun.id, "2026-09", "reset");
await tx("2026-09-10", -120_000, food.id);
await tx("2026-09-12", -30_000, fun.id);
const sep = await computeBudget("2026-09");
assert.equal(sep.leftToBudget, 1_000_000 - 150_000);
assert.equal(sep.rows.find((r) => r.name === "Food")!.available, -20_000, "overspend stays in its category");

// October: no new income. Food carries −200; Fun resets and returns its 200 to the pool.
let oct = await computeBudget("2026-10");
const foodOct = oct.rows.find((r) => r.name === "Food")!;
assert.equal(foodOct.carryIn, -20_000);
assert.equal(oct.fromLastMonth, 850_000 + 20_000, "reset leftover returns to Left to Budget");
// A USD 20 purchase at 3.6725 = AED 73.45 lands in Food's spent.
await tx("2026-10-05", -2000, food.id, "USD", 3.6725);
await copyLastMonth("2026-10");
oct = await computeBudget("2026-10");
assert.equal(oct.rows.find((r) => r.name === "Food")!.spent, 7345);
assert.equal(oct.assignedTotal, 150_000, "copy last month");
assert.equal(oct.leftToBudget, 870_000 - 150_000);
// Cover Food's overspend from Fun.
await moveMoney(fun.id, food.id, "2026-10", 20_000);
oct = await computeBudget("2026-10");
assert.equal(oct.rows.find((r) => r.name === "Food")!.available, -20_000 + 120_000 - 7345);
assert.equal(oct.leftToBudget, 720_000, "moving money does not change Left to Budget");
// Uncategorised spending comes out of Left to Budget.
await tx("2026-10-06", -5_000, null);
assert.equal((await computeBudget("2026-10")).leftToBudget, 715_000);
console.log("budget tests: all passed");
await prisma.$disconnect();
