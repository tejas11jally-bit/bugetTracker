"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { endSession, hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { seedStarterData } from "@/lib/seed";
import { isCurrency, toMinor } from "@/lib/money";

export type FormState = { error?: string; ok?: string } | undefined;

export async function setupAction(_prev: FormState, form: FormData): Promise<FormState> {
  if ((await prisma.user.count()) > 0) return { error: "Ledgerly is already set up. Sign in instead." };
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const timezone = String(form.get("timezone") ?? "Asia/Dubai");
  if (!name || !email) return { error: "Name and email are required." };
  if (password.length < 10) return { error: "Use a password of at least 10 characters." };

  const user = await prisma.user.create({ data: { name, email, passwordHash: hashPassword(password), timezone } });
  await seedStarterData({ categories: form.get("starter") === "on" });

  // Accounts with balances (onboarding screen).
  for (let i = 0; i < 4; i++) {
    const accName = String(form.get(`acc${i}_name`) ?? "").trim();
    if (!accName) continue;
    const type = String(form.get(`acc${i}_type`) ?? "debit");
    const currency = String(form.get(`acc${i}_currency`) ?? "AED");
    const cur = isCurrency(currency) ? currency : "AED";
    const balance = toMinor(String(form.get(`acc${i}_balance`) || "0"), cur) ?? 0;
    await prisma.account.create({ data: { name: accName, type, currency: cur, openingBalance: type === "credit" ? -Math.abs(balance) : balance } });
  }

  await startSession(user.id);
  redirect("/onboarding");
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const user = await prisma.user.findFirst();
  if (!user) redirect("/setup");
  if (!verifyPassword(password, user.passwordHash)) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Wrong password." };
  }
  await startSession(user.id);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}
