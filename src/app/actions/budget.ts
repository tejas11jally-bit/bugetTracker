"use server";

import { revalidatePath } from "next/cache";
import { copyLastMonth, moveMoney, setAssigned, setRolloverMode } from "@/lib/budget";
import { toMinor } from "@/lib/money";

export async function assign(form: FormData) {
  const amount = toMinor(String(form.get("amount") || "0"), "AED");
  if (amount == null) return;
  await setAssigned(Number(form.get("categoryId")), String(form.get("month")), amount);
  revalidatePath("/", "layout");
}

export async function rollover(form: FormData) {
  await setRolloverMode(Number(form.get("categoryId")), String(form.get("month")), form.get("mode") === "reset" ? "reset" : "carry");
  revalidatePath("/budget");
}

export async function copyPrevious(form: FormData) {
  await copyLastMonth(String(form.get("month")));
  revalidatePath("/", "layout");
}

export async function cover(form: FormData) {
  const amount = toMinor(String(form.get("amount") || "0"), "AED");
  const from = Number(form.get("from"));
  const to = Number(form.get("to"));
  if (!amount || amount <= 0 || !from || from === to) return;
  await moveMoney(from, to, String(form.get("month")), amount);
  revalidatePath("/", "layout");
}
