"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { markPaid, skip, CADENCES } from "@/lib/recurring";
import { isCurrency, toMinor } from "@/lib/money";
import { parseDateInput } from "@/lib/dates";
import { templateFor } from "@/lib/goals";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function saveRecurring(form: FormData) {
  const id = Number(form.get("id") || 0);
  const currency = isCurrency(str(form, "currency")) ? str(form, "currency") : "AED";
  const amount = toMinor(str(form, "amount"), currency);
  const date = parseDateInput(str(form, "nextDueDate"));
  const cadence = (CADENCES as readonly string[]).includes(str(form, "cadence")) ? str(form, "cadence") : "monthly";
  if (!amount || !date || !str(form, "name")) return;
  const data = {
    name: str(form, "name"),
    amount: str(form, "kind") === "income" ? Math.abs(amount) : -Math.abs(amount),
    currency,
    accountId: Number(form.get("accountId")),
    categoryId: Number(form.get("categoryId")) || null,
    cadence,
    interval: Math.max(1, Number(str(form, "interval") || 1)),
    nextDueDate: date,
    autoPost: form.get("autoPost") === "on",
  };
  if (id) await prisma.recurringItem.update({ where: { id }, data });
  else await prisma.recurringItem.create({ data });
  revalidatePath("/", "layout");
  if (id) redirect("/bills");
}

export async function paid(form: FormData) {
  await markPaid(Number(form.get("id")));
  revalidatePath("/", "layout");
}

export async function skipOnce(form: FormData) {
  await skip(Number(form.get("id")));
  revalidatePath("/", "layout");
}

export async function archiveRecurring(form: FormData) {
  await prisma.recurringItem.update({ where: { id: Number(form.get("id")) }, data: { archived: true } });
  revalidatePath("/", "layout");
}

// ---------- Goals (F12, F25) ----------

export async function saveGoal(form: FormData) {
  const id = Number(form.get("id") || 0);
  const target = toMinor(str(form, "targetAmount"), "AED");
  if (!target || target <= 0) return;
  const templateKey = str(form, "templateKey") || "custom";
  const data = {
    name: str(form, "name") || templateFor(templateKey)?.name || "Goal",
    templateKey,
    targetAmount: target,
    targetDate: parseDateInput(str(form, "targetDate")),
    linkedAccountId: Number(form.get("linkedAccountId")) || null,
    savedAmount: toMinor(str(form, "savedAmount") || "0", "AED") ?? 0,
  };
  if (id) await prisma.goal.update({ where: { id }, data });
  else await prisma.goal.create({ data });
  revalidatePath("/goals");
  redirect("/goals");
}

export async function contribute(form: FormData) {
  const amount = toMinor(str(form, "amount"), "AED");
  if (!amount) return;
  await prisma.goal.update({ where: { id: Number(form.get("id")) }, data: { savedAmount: { increment: amount } } });
  revalidatePath("/goals");
}

export async function archiveGoal(form: FormData) {
  await prisma.goal.update({ where: { id: Number(form.get("id")) }, data: { archived: true } });
  revalidatePath("/goals");
}
