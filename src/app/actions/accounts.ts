"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isCurrency, toMinor } from "@/lib/money";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const day = (v: string) => {
  const n = Number(v);
  return n >= 1 && n <= 31 ? n : null;
};

export async function saveAccount(form: FormData) {
  const id = Number(form.get("id") || 0);
  const type = ["cash", "debit", "credit", "savings"].includes(str(form, "type")) ? str(form, "type") : "debit";
  const currency = isCurrency(str(form, "currency")) ? str(form, "currency") : "AED";
  const opening = toMinor(str(form, "openingBalance") || "0", currency) ?? 0;
  const data = {
    name: str(form, "name"),
    type,
    currency,
    openingBalance: type === "credit" ? -Math.abs(opening) : opening,
    statementDay: type === "credit" ? day(str(form, "statementDay")) : null,
    dueDay: type === "credit" ? day(str(form, "dueDay")) : null,
    archived: form.get("archived") === "on",
  };
  if (!data.name) return;
  if (id) await prisma.account.update({ where: { id }, data });
  else await prisma.account.create({ data });
  revalidatePath("/", "layout");
  redirect("/accounts");
}
