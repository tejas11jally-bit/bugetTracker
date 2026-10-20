"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword, newToken, hashToken, verifyPassword } from "@/lib/auth";
import { sendPush } from "@/lib/push";
import { REMINDER_DEFAULTS, type Schedule } from "@/lib/reminders";
import { setManualRate, fetchDailyRates } from "@/lib/fx";
import { isCurrency } from "@/lib/money";
import { today } from "@/lib/dates";
import { CATEGORY_GROUPS } from "@/lib/seed";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function user() {
  return prisma.user.findFirstOrThrow();
}

export async function dismissChecklist() {
  const u = await user();
  await prisma.user.update({ where: { id: u.id }, data: { checklistDismissed: true } });
  revalidatePath("/");
}

// ---------- Profile, locale, privacy, appearance (F29) ----------

export async function saveProfile(form: FormData) {
  const u = await user();
  const tz = str(form, "timezone") || u.timezone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    return;
  }
  await prisma.user.update({
    where: { id: u.id },
    data: {
      name: str(form, "name") || u.name,
      email: str(form, "email") || u.email,
      timezone: tz,
      weekStart: Number(str(form, "weekStart") || 1),
      quietHoursStart: str(form, "quietStart") || u.quietHoursStart,
      quietHoursEnd: str(form, "quietEnd") || u.quietHoursEnd,
      pushShowAmounts: form.get("pushShowAmounts") === "on",
      maxPushesPerDay: Math.min(10, Math.max(1, Number(str(form, "maxPushes") || 3))),
    },
  });
  revalidatePath("/", "layout");
}

export async function saveAppearance(form: FormData) {
  const u = await user();
  const theme = ["light", "dark", "system"].includes(str(form, "theme")) ? str(form, "theme") : "system";
  const accent = /^#[0-9a-f]{6}$/i.test(str(form, "accent")) ? str(form, "accent") : u.accent;
  await prisma.user.update({ where: { id: u.id }, data: { theme, accent } });
  revalidatePath("/", "layout");
}

export async function changePassword(_prev: { error?: string; ok?: string } | undefined, form: FormData) {
  const u = await user();
  if (!verifyPassword(str(form, "current"), u.passwordHash)) return { error: "Current password is wrong." };
  const next = String(form.get("next") ?? "");
  if (next.length < 10) return { error: "Use at least 10 characters." };
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hashPassword(next) } });
  return { ok: "Password changed." };
}

export async function deletePasskey(form: FormData) {
  await prisma.passkey.delete({ where: { id: Number(form.get("id")) } });
  revalidatePath("/settings");
}

// ---------- Categories ----------

export async function saveCategory(form: FormData) {
  const id = Number(form.get("id") || 0);
  const group = CATEGORY_GROUPS.includes(str(form, "group") as (typeof CATEGORY_GROUPS)[number]) ? str(form, "group") : "Lifestyle";
  const data = {
    name: str(form, "name"),
    group,
    icon: str(form, "icon") || "•",
    colour: /^#[0-9a-f]{6}$/i.test(str(form, "colour")) ? str(form, "colour") : "#64748b",
    archived: form.get("archived") === "on",
  };
  if (!data.name) return;
  if (id) await prisma.category.update({ where: { id }, data });
  else await prisma.category.create({ data: { ...data, sortOrder: (await prisma.category.count()) + 1 } });
  revalidatePath("/settings/categories");
}

// ---------- Reminders and devices (F16) ----------

export async function saveReminder(form: FormData) {
  const type = str(form, "type");
  const r = await prisma.reminder.findUniqueOrThrow({ where: { type } });
  const schedule = JSON.parse(r.schedule) as Schedule;
  const time = str(form, "time");
  if (/^\d{2}:\d{2}$/.test(time)) schedule.time = time;
  const days = form.getAll("days").map(Number);
  if (schedule.days && days.length) schedule.days = days;
  if (schedule.hours !== undefined) schedule.hours = Math.max(12, Number(str(form, "hours") || 48));
  await prisma.reminder.update({ where: { type }, data: { enabled: form.get("enabled") === "on", schedule: JSON.stringify(schedule) } });
  revalidatePath("/settings/reminders");
}

export async function resetReminder(form: FormData) {
  const type = str(form, "type");
  const d = REMINDER_DEFAULTS.find((x) => x.type === type);
  if (d) await prisma.reminder.update({ where: { type }, data: { schedule: JSON.stringify(d.schedule), enabled: d.enabled } });
  revalidatePath("/settings/reminders");
}

export async function testNotification(form: FormData) {
  const u = await user();
  const id = Number(form.get("id") || 0) || undefined;
  await sendPush({ title: "Ledgerly test", body: "Notifications work. Tap to open quick add.", url: "/add", tag: "test" }, { kind: "test", onlyId: id, tz: u.timezone, ignoreCap: true });
  revalidatePath("/settings/reminders");
}

export async function removeDevice(form: FormData) {
  await prisma.pushSubscription.delete({ where: { id: Number(form.get("id")) } });
  revalidatePath("/settings/reminders");
}

export async function renameDevice(form: FormData) {
  await prisma.pushSubscription.update({ where: { id: Number(form.get("id")) }, data: { deviceLabel: str(form, "label") || "Device" } });
  revalidatePath("/settings/reminders");
}

// ---------- Shortcut tokens (F20, F21) ----------

export async function createApiToken(_prev: { token?: string; label?: string } | undefined, form: FormData) {
  const label = str(form, "label") || "Shortcut";
  const token = newToken();
  await prisma.apiToken.create({ data: { label, tokenHash: hashToken(token) } });
  revalidatePath("/settings/shortcuts");
  return { token, label };
}

export async function revokeApiToken(form: FormData) {
  await prisma.apiToken.update({ where: { id: Number(form.get("id")) }, data: { revoked: true } });
  revalidatePath("/settings/shortcuts");
}

// ---------- Merchant rules (F22) ----------

export async function saveRule(form: FormData) {
  const id = Number(form.get("id") || 0);
  const matchText = str(form, "matchText").toLowerCase();
  const categoryId = Number(form.get("categoryId"));
  if (!matchText || !categoryId) return;
  if (id) await prisma.merchantRule.update({ where: { id }, data: { matchText, categoryId } });
  else await prisma.merchantRule.upsert({ where: { matchText }, create: { matchText, categoryId }, update: { categoryId } });
  revalidatePath("/settings/rules");
}

export async function deleteRule(form: FormData) {
  await prisma.merchantRule.delete({ where: { id: Number(form.get("id")) } });
  revalidatePath("/settings/rules");
}

// ---------- Exchange rates (F23) ----------

export async function saveRate(form: FormData) {
  const currency = str(form, "currency");
  const rate = Number(str(form, "rate"));
  if (!isCurrency(currency) || currency === "AED" || !(rate > 0)) return;
  const u = await user();
  await setManualRate(currency, str(form, "date") || today(u.timezone), rate);
  revalidatePath("/settings/rates");
}

export async function refreshRates() {
  await fetchDailyRates();
  revalidatePath("/settings/rates");
}

export async function backupNow() {
  const { runBackup } = await import("@/lib/backup");
  await runBackup();
  revalidatePath("/settings/data");
}
