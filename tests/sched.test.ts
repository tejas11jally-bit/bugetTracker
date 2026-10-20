import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { tick, latestOccurrence } from "@/lib/reminders";
import { setState, sendPush } from "@/lib/push";
import { zonedToUtc } from "@/lib/dates";

const tz = "Asia/Dubai";
const at = (d: string, t: string) => zonedToUtc(d, t, tz);
const logs = async () => (await prisma.pushLog.findMany({ orderBy: { id: "asc" } })).map((l) => l.kind);

// Occurrence maths
assert.equal(latestOccurrence("daily_log", { time: "21:00", days: [0, 1, 2, 3, 4, 5, 6] }, at("2026-10-21", "21:05"), tz)!.toISOString(), "2026-10-21T17:00:00.000Z");
assert.equal(latestOccurrence("weekly_review", { time: "10:00", days: [5] }, at("2026-10-21", "09:00"), tz)!.toISOString().slice(0, 10), "2026-10-16");
assert.equal(latestOccurrence("month_close", { time: "20:00", lastDay: true }, at("2026-11-05", "12:00"), tz)!.toISOString(), at("2026-10-31", "20:00").toISOString());

// Seed: one user and the default reminders on an empty database.
import { ensureReminders } from "@/lib/reminders";
await prisma.user.create({ data: { name: "T", email: "t@x", passwordHash: "x" } });
await ensureReminders();

// Fresh state: one fake device (unreachable endpoint), reminders created long ago, no pushes yet.
await prisma.pushLog.deleteMany();
await prisma.pushSubscription.deleteMany();
await prisma.pushSubscription.create({ data: { deviceLabel: "Test", endpoint: "https://127.0.0.1:9/push", keys: JSON.stringify({ p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" }) } });
await prisma.reminder.updateMany({ data: { lastSentAt: null, createdAt: new Date("2026-01-01") } });
await prisma.reminder.update({ where: { type: "inactivity" }, data: { enabled: false } });
await prisma.recurringItem.updateMany({ data: { archived: true } }); // keep bill_due quiet

// 1. Scheduler alive at 20:59 and 21:00 → daily log push at 21:00.
await setState("heartbeat", at("2026-10-21", "20:58").toISOString());
await tick(at("2026-10-21", "20:59"));
await tick(at("2026-10-21", "21:00"));
assert.deepEqual(await logs(), ["daily_log"], "21:00 reminder sent once");
await tick(at("2026-10-21", "21:01"));
assert.deepEqual(await logs(), ["daily_log"], "not resent a minute later");

// 2. Server off from 22/10 08:00 to 23/10 12:00 (missed 22/10 21:00 daily and Fri 23/10 10:00 weekly) → one catch-up push.
await setState("heartbeat", at("2026-10-22", "08:00").toISOString());
await tick(at("2026-10-23", "12:00"));
assert.deepEqual(await logs(), ["daily_log", "catchup"], "missed reminders collapse into one catch-up");

// 3. Quiet hours: a reminder at 23:15 is skipped.
await prisma.reminder.update({ where: { type: "daily_log" }, data: { schedule: JSON.stringify({ time: "23:15", days: [0, 1, 2, 3, 4, 5, 6] }) } });
await setState("heartbeat", at("2026-10-24", "23:14").toISOString());
await tick(at("2026-10-24", "23:15"));
assert.equal((await logs()).length, 2, "no push during quiet hours");

// 4. Catch-up that becomes due during quiet hours waits until 08:00.
await prisma.reminder.update({ where: { type: "daily_log" }, data: { schedule: JSON.stringify({ time: "21:00", days: [0, 1, 2, 3, 4, 5, 6] }) } });
await setState("heartbeat", at("2026-10-25", "18:00").toISOString());
await tick(at("2026-10-26", "02:00"));
assert.equal((await logs()).length, 2, "catch-up held during quiet hours");
await tick(at("2026-10-26", "08:00"));
assert.deepEqual((await logs()).slice(-1), ["catchup"], "catch-up sent when quiet hours end");

// 5. Daily cap of 3 (test pushes ignore the cap).
await prisma.pushLog.deleteMany();
const r = [];
for (let i = 0; i < 4; i++) r.push((await sendPush({ title: "t", body: "b", url: "/" }, { kind: "cap", tz })).capped);
assert.deepEqual(r, [false, false, false, true], "4th push of the day is capped");

// 6. Failed delivery is logged as failed; unreachable host keeps the device active, 410 Gone would mark it inactive.
const last = await prisma.pushLog.findFirst({ orderBy: { id: "desc" } });
assert.equal(last!.delivered, 0); assert.equal(last!.failed, 1);
console.log("scheduler tests: all passed");
await prisma.$disconnect();
