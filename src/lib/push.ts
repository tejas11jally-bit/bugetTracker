import webpush from "web-push";
import { prisma } from "./db";
import { getSecrets } from "./secrets";
import { today } from "./dates";

let configured = false;
function configure() {
  if (configured) return;
  const s = getSecrets();
  webpush.setVapidDetails("mailto:ledgerly@localhost", s.vapidPublicKey, s.vapidPrivateKey);
  configured = true;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Sends to every active device. Expired subscriptions are marked inactive (PRD "Subscription flow" 4). */
export async function sendPush(payload: PushPayload, opts: { kind: string; onlyId?: number; tz: string; ignoreCap?: boolean }) {
  configure();
  const date = today(opts.tz);
  if (!opts.ignoreCap) {
    const user = await prisma.user.findFirst();
    const sentToday = await prisma.pushLog.count({ where: { date, kind: { not: "test" } } });
    if (sentToday >= (user?.maxPushesPerDay ?? 3)) return { delivered: 0, failed: 0, capped: true };
  }
  const subs = await prisma.pushSubscription.findMany({ where: opts.onlyId ? { id: opts.onlyId } : { active: true } });
  let delivered = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: JSON.parse(sub.keys) as { p256dh: string; auth: string } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 4, urgency: "high" },
      );
      delivered++;
      await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastSuccessAt: new Date(), lastError: null, active: true } });
    } catch (e) {
      failed++;
      const status = (e as { statusCode?: number }).statusCode;
      const gone = status === 404 || status === 410 || status === 403;
      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastError: `${status ?? ""} ${(e as Error).message}`.trim().slice(0, 300), active: gone ? false : sub.active },
      });
    }
  }
  await prisma.pushLog.create({ data: { date, kind: opts.kind, title: payload.title, delivered, failed } });
  await setState("last_reminder_sent", new Date().toISOString());
  return { delivered, failed, capped: false };
}

export async function getState(key: string): Promise<string | null> {
  return (await prisma.appState.findUnique({ where: { key } }))?.value ?? null;
}

export async function setState(key: string, value: string) {
  await prisma.appState.upsert({ where: { key }, create: { key, value }, update: { value } });
}
