import { prisma } from "./db";
import { addDays, dayOfWeek, lastDayOfMonth, timeToMinutes, today, zonedParts, zonedToUtc } from "./dates";
import { formatAED } from "./money";
import { getState, sendPush, setState, type PushPayload } from "./push";
import { autoPostDue } from "./recurring";
import { checkBillsDueTomorrow } from "./alerts";
import { fetchDailyRates } from "./fx";
import { runBackup } from "./backup";
import { computeBudget } from "./budget";

// F16 reminders. Schedules are JSON in reminders.schedule:
//   { time: "21:00", days: [0..6] }      weekday list, 0 = Sunday
//   { time: "20:00", lastDay: true }     last day of the month
//   { time: "09:00", daysBefore: 1 }     bill due
//   { hours: 48 }                        inactivity
export type Schedule = { time?: string; days?: number[]; lastDay?: boolean; daysBefore?: number; hours?: number };

export const REMINDER_DEFAULTS: { type: string; label: string; schedule: Schedule; enabled: boolean; opens: string }[] = [
  { type: "daily_log", label: "Daily log check", schedule: { time: "21:00", days: [0, 1, 2, 3, 4, 5, 6] }, enabled: true, opens: "Quick add" },
  { type: "midday", label: "Midday nudge", schedule: { time: "14:00", days: [1, 2, 3, 4, 5] }, enabled: false, opens: "Quick add" },
  { type: "bill_due", label: "Bill due", schedule: { time: "09:00", daysBefore: 1 }, enabled: true, opens: "That bill" },
  { type: "weekly_review", label: "Weekly review", schedule: { time: "10:00", days: [5] }, enabled: true, opens: "Week summary" },
  { type: "month_close", label: "Month close", schedule: { time: "20:00", lastDay: true }, enabled: true, opens: "Budget rollover" },
  { type: "inactivity", label: "Inactivity", schedule: { hours: 48 }, enabled: true, opens: "Quick add" },
];

export async function ensureReminders() {
  for (const r of REMINDER_DEFAULTS) {
    await prisma.reminder.upsert({
      where: { type: r.type },
      create: { type: r.type, schedule: JSON.stringify(r.schedule), enabled: r.enabled },
      update: {},
    });
  }
}

function isQuiet(minutes: number, start: string, end: string) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return s <= e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

/** Most recent scheduled instant at or before `now`, looking back up to 40 days. */
export function latestOccurrence(type: string, schedule: Schedule, now: Date, tz: string): Date | null {
  if (!schedule.time) return null;
  const t = zonedParts(now, tz).date;
  for (let i = 0; i < 40; i++) {
    const d = addDays(t, -i);
    let matches = false;
    if (schedule.lastDay) matches = d === lastDayOfMonth(d.slice(0, 7));
    else if (schedule.days) matches = schedule.days.includes(dayOfWeek(d));
    else matches = true; // bill_due: daily check
    if (!matches) continue;
    const at = zonedToUtc(d, schedule.time, tz);
    if (at <= now) return at;
  }
  return null;
}

async function buildPayload(type: string, tz: string): Promise<PushPayload | null> {
  const user = await prisma.user.findFirst();
  const showAmounts = user?.pushShowAmounts ?? false;
  const t = today(tz);
  switch (type) {
    case "daily_log":
    case "midday": {
      const count = await prisma.transaction.count({ where: { date: t, parentId: null, source: { not: "recurring" } } });
      const body = type === "midday" ? "Quick check: anything to log since this morning?" : count > 0 ? `Logged ${count} today. Anything else?` : "Anything to log today?";
      return { title: "Ledgerly", body, url: "/add?from=reminder", tag: type };
    }
    case "bill_due": {
      const bills = await checkBillsDueTomorrow(tz);
      if (bills.length === 0) return null;
      const first = bills[0];
      const amount = showAmounts ? ` (${formatAED(-first.amount)})` : "";
      const body = bills.length === 1 ? `${first.name}${amount} is due tomorrow.` : `${bills.length} bills are due tomorrow.`;
      return { title: "Bill due tomorrow", body, url: bills.length === 1 ? `/bills?focus=${first.id}` : "/bills", tag: "bill_due" };
    }
    case "weekly_review": {
      const review = await prisma.transaction.count({ where: { status: "review" } });
      let body = review > 0 ? `${review} item${review === 1 ? "" : "s"} waiting in Review.` : "Your week in review is ready.";
      if (showAmounts) {
        const b = await computeBudget(t.slice(0, 7));
        body += ` Spent ${formatAED(b.spentTotal)} of ${formatAED(b.assignedTotal)} this month.`;
      }
      return { title: "Weekly review", body, url: "/review", tag: "weekly_review" };
    }
    case "month_close":
      return { title: "Month close", body: "Last day of the month. Roll over your budget and set up next month.", url: "/budget?close=1", tag: "month_close" };
    case "inactivity":
      return { title: "Ledgerly", body: "Nothing logged for 2 days. Add a purchase or tap Nothing today to keep your streak.", url: "/add?from=reminder", tag: "inactivity" };
  }
  return null;
}

async function send(type: string, tz: string) {
  const payload = await buildPayload(type, tz);
  if (!payload) return;
  await sendPush(payload, { kind: type, tz });
}

let running = false;

/** Runs every minute from instrumentation.ts. */
export async function tick(now = new Date()) {
  if (running) return;
  running = true;
  try {
    // Heartbeat first, so "Server last online" is accurate even before setup.
    const prevBeat = await getState("heartbeat");
    await setState("heartbeat", now.toISOString());
    const user = await prisma.user.findFirst();
    if (!user) return;
    const tz = user.timezone;
    const local = zonedParts(now, tz);
    const minutes = local.hour * 60 + local.minute;
    const quiet = isQuiet(minutes, user.quietHoursStart, user.quietHoursEnd);

    const prev = prevBeat ? new Date(prevBeat) : null;
    const gap = prev ? now.getTime() - prev.getTime() > 3 * 60_000 : false;

    await dailyJobs(now, tz, local.hour);

    const reminders = await prisma.reminder.findMany({ where: { enabled: true } });
    const missed: string[] = [];

    for (const r of reminders) {
      const schedule = JSON.parse(r.schedule) as Schedule;
      if (r.type === "inactivity") continue;
      const at = latestOccurrence(r.type, schedule, now, tz);
      if (!at) continue;
      const last = r.lastSentAt ?? r.createdAt;
      if (at <= last) continue;
      const atLocal = zonedParts(at, tz);
      const atQuiet = isQuiet(atLocal.hour * 60 + atLocal.minute, user.quietHoursStart, user.quietHoursEnd);
      await prisma.reminder.update({ where: { id: r.id }, data: { lastSentAt: now } });
      if (atQuiet) continue;
      if (now.getTime() - at.getTime() <= 10 * 60_000) await send(r.type, tz);
      else if (gap && prev && at > prev) missed.push(r.type);
      // Otherwise the occurrence is stale (e.g. first start): skip silently.
    }

    // Missed reminders collapse into one catch-up push, held until quiet hours end.
    if (missed.length) await setState("pending_catchup", "1");
    if (!quiet && (await getState("pending_catchup")) === "1") {
      await setState("pending_catchup", "0");
      await sendPush(
        { title: "Ledgerly is back online", body: "Reminders were missed while the server was off. Anything to log?", url: "/add?from=reminder", tag: "catchup" },
        { kind: "catchup", tz },
      );
    }

    const inactivity = reminders.find((r) => r.type === "inactivity");
    if (inactivity && !quiet) {
      const hours = (JSON.parse(inactivity.schedule) as Schedule).hours ?? 48;
      const lastTx = await prisma.transaction.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      const lastCheck = await prisma.checkin.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } });
      const lastActivity = new Date(Math.max(lastTx?.createdAt.getTime() ?? 0, lastCheck?.updatedAt.getTime() ?? 0, user.createdAt.getTime()));
      const idle = now.getTime() - lastActivity.getTime() >= hours * 3_600_000;
      if (idle && (!inactivity.lastSentAt || inactivity.lastSentAt < lastActivity)) {
        await prisma.reminder.update({ where: { id: inactivity.id }, data: { lastSentAt: now } });
        await send("inactivity", tz);
      }
    }
  } catch (e) {
    console.error("[scheduler]", e);
  } finally {
    running = false;
  }
}

/** Once-a-day jobs. Each runs at or after its hour, and catches up after downtime. */
async function dailyJobs(now: Date, tz: string, hour: number) {
  const t = today(tz);
  const once = async (key: string, atHour: number, job: () => Promise<unknown>) => {
    if (hour < atHour) return;
    if ((await getState(`job:${key}`)) === t) return;
    await setState(`job:${key}`, t);
    try {
      await job();
    } catch (e) {
      console.error(`[job:${key}]`, e);
    }
  };
  await once("backup", 3, () => runBackup());
  await once("fx", 6, () => fetchDailyRates());
  await once("autopost", 6, async () => {
    const posted = await autoPostDue(t);
    if (posted.length) {
      const names = posted.map((p) => p.name).join(", ");
      await sendPush({ title: "Auto-posted", body: `Posted: ${names}.`, url: "/bills", tag: "autopost" }, { kind: "autopost", tz });
    }
  });
  await once("alerts", 8, () => checkBillsDueTomorrow(tz));
  void now;
}
