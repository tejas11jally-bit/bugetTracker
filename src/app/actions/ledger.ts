"use server";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { afterWrite, deleteTransaction, duplicateTransaction, learnRule, setSplits, createTransaction } from "@/lib/ledger";
import { getRate } from "@/lib/fx";
import { decimalsOf, isCurrency, toBase, toMinor } from "@/lib/money";
import { parseDateInput, today } from "@/lib/dates";
import { RECEIPT_DIR } from "@/lib/paths";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function refresh() {
  revalidatePath("/", "layout");
}

/** Edit any field, including the per-transaction exchange rate (F23). */
export async function updateTransaction(form: FormData) {
  const id = Number(form.get("id"));
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  const type = (["expense", "income", "transfer"].includes(str(form, "type")) ? str(form, "type") : tx.type) as "expense" | "income" | "transfer";
  const currency = isCurrency(str(form, "currency")) ? str(form, "currency") : tx.currency;
  const amountAbs = toMinor(str(form, "amount"), currency);
  if (amountAbs == null || amountAbs <= 0) return;
  const date = parseDateInput(str(form, "date")) ?? tx.date;
  const accountId = Number(form.get("accountId")) || tx.accountId;
  const rateInput = Number(str(form, "fxRate"));
  const rateChanged = rateInput > 0 && Math.abs(rateInput - tx.fxRate) > 1e-9;
  const fxRate = currency === "AED" ? 1 : rateChanged ? rateInput : currency !== tx.currency || date !== tx.date ? (await getRate(currency, date)).rate : tx.fxRate;
  const amount = type === "income" ? amountAbs : -amountAbs;
  const amountBase = toBase(amount, currency, fxRate);
  const categoryId = type === "transfer" ? null : Number(form.get("categoryId")) || null;
  const transferAccountId = type === "transfer" ? Number(form.get("transferAccountId")) || null : null;
  let transferAmount: number | null = null;
  if (type === "transfer" && transferAccountId) {
    const dest = await prisma.account.findUniqueOrThrow({ where: { id: transferAccountId } });
    const typed = toMinor(str(form, "transferAmount"), dest.currency);
    transferAmount =
      typed && typed > 0
        ? typed
        : dest.currency === currency
          ? amountAbs
          : Math.round((Math.abs(amountBase) / 100 / (await getRate(dest.currency, date)).rate) * 10 ** decimalsOf(dest.currency));
  }
  const categoryChanged = categoryId !== tx.categoryId;

  await prisma.transaction.update({
    where: { id },
    data: {
      type,
      currency,
      amountOriginal: amount,
      fxRate,
      amountBase,
      date,
      accountId,
      categoryId: tx.split ? null : categoryId,
      transferAccountId,
      transferAmount,
      payee: str(form, "payee"),
      note: str(form, "note"),
      tags: str(form, "tags")
        .split(",")
        .map((t) => t.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean)
        .join(","),
      status: form.get("confirm") === "1" ? "confirmed" : tx.status,
    },
  });
  // Keep split children in step with the parent's date/account/rate.
  if (tx.split) {
    const children = await prisma.transaction.findMany({ where: { parentId: id } });
    for (const c of children) await prisma.transaction.update({ where: { id: c.id }, data: { date, accountId, currency, fxRate, amountBase: toBase(c.amountOriginal, currency, fxRate) } });
  }
  await afterWrite(id, categoryChanged);
  refresh();
  redirect(str(form, "back") || "/transactions");
}

export async function removeTransaction(form: FormData) {
  const id = Number(form.get("id"));
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (tx?.receiptPath) fs.rmSync(path.join(RECEIPT_DIR, tx.receiptPath), { force: true });
  await deleteTransaction(id);
  refresh();
  redirect(str(form, "back") || "/transactions");
}

export async function duplicate(form: FormData) {
  const user = await prisma.user.findFirstOrThrow();
  const copy = await duplicateTransaction(Number(form.get("id")), today(user.timezone));
  refresh();
  redirect(`/transactions/${copy.id}`);
}

/** Review queue (F20): confirm, optionally with a corrected category. Corrections teach rules (F22). */
export async function confirmReview(form: FormData) {
  const id = Number(form.get("id"));
  const categoryId = Number(form.get("categoryId")) || null;
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  await prisma.transaction.update({ where: { id }, data: { status: "confirmed", categoryId: tx.split ? null : (categoryId ?? tx.categoryId) } });
  if (tx.payee && (categoryId ?? tx.categoryId)) await learnRule(tx.payee, (categoryId ?? tx.categoryId)!);
  await afterWrite(id, false);
  refresh();
}

export async function confirmAllReview() {
  const items = await prisma.transaction.findMany({ where: { status: "review", parentId: null } });
  for (const tx of items) {
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: "confirmed" } });
    if (tx.payee && tx.categoryId) await learnRule(tx.payee, tx.categoryId);
  }
  refresh();
}

/** Bulk recategorise from the transactions list. */
export async function bulkRecategorise(form: FormData) {
  const ids = form.getAll("ids").map(Number).filter(Boolean);
  const categoryId = Number(form.get("categoryId")) || null;
  if (!ids.length || !categoryId) return;
  const txs = await prisma.transaction.findMany({ where: { id: { in: ids }, split: false, type: { not: "transfer" } } });
  for (const tx of txs) {
    await prisma.transaction.update({ where: { id: tx.id }, data: { categoryId, status: "confirmed" } });
    if (tx.payee) await learnRule(tx.payee, categoryId);
    await afterWrite(tx.id, false);
  }
  refresh();
}

/** F5 splits. Body: JSON [{categoryId, amount}] with amounts as decimal strings. */
export async function saveSplits(id: number, rows: { categoryId: number; amount: string }[]) {
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  const sign = tx.amountOriginal < 0 ? -1 : 1;
  const parsed = rows
    .map((r) => ({ categoryId: Number(r.categoryId), amount: (toMinor(r.amount, tx.currency) ?? 0) * sign }))
    .filter((r) => r.categoryId && r.amount !== 0);
  const total = parsed.reduce((s, r) => s + r.amount, 0);
  if (parsed.length > 1 && total !== tx.amountOriginal) return { error: "Split amounts must add up to the total." };
  await setSplits(id, parsed, parsed.length === 1 ? parsed[0].categoryId : tx.categoryId);
  refresh();
  return { ok: true };
}

/** F18 receipt photo, stored locally in the data volume. */
export async function uploadReceipt(form: FormData) {
  const id = Number(form.get("id"));
  const file = form.get("receipt");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 15 * 1024 * 1024) return;
  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heic", "image/webp": "webp", "application/pdf": "pdf" } as Record<string, string>)[file.type];
  if (!ext) return;
  fs.mkdirSync(RECEIPT_DIR, { recursive: true });
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  if (tx.receiptPath) fs.rmSync(path.join(RECEIPT_DIR, tx.receiptPath), { force: true });
  const name = `${id}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(RECEIPT_DIR, name), Buffer.from(await file.arrayBuffer()));
  await prisma.transaction.update({ where: { id }, data: { receiptPath: name } });
  revalidatePath(`/transactions/${id}`);
}

export async function removeReceipt(form: FormData) {
  const id = Number(form.get("id"));
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  if (tx.receiptPath) fs.rmSync(path.join(RECEIPT_DIR, tx.receiptPath), { force: true });
  await prisma.transaction.update({ where: { id }, data: { receiptPath: null } });
  revalidatePath(`/transactions/${id}`);
}

/** F8 reconcile: record the bank balance and optionally post the suggested adjustment. */
export async function reconcile(form: FormData) {
  const accountId = Number(form.get("accountId"));
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  const bank = toMinor(str(form, "bankBalance"), account.currency);
  const appBalance = Number(form.get("appBalance"));
  if (bank == null) return;
  const signedBank = account.type === "credit" && form.get("owed") === "on" ? -Math.abs(bank) : bank;
  const gap = signedBank - appBalance;
  const denom = Math.max(Math.abs(signedBank), Math.abs(appBalance), 1);
  const user = await prisma.user.findFirstOrThrow();
  if (form.get("adjust") === "1" && gap !== 0) {
    await createTransaction({
      accountId,
      categoryId: null,
      date: today(user.timezone),
      currency: account.currency,
      amount: gap,
      type: gap < 0 ? "expense" : "income",
      payee: "Reconcile adjustment",
      note: "Posted from reconcile",
      source: "manual",
      learn: false,
    });
  }
  await prisma.account.update({
    where: { id: accountId },
    data: { reconciledAt: new Date(), reconciledBalance: signedBank, reconcileGapBp: Math.round((Math.abs(gap) / denom) * 10000) },
  });
  refresh();
  redirect(`/accounts/${accountId}?reconciled=1`);
}
