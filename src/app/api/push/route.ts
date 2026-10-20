import { prisma } from "@/lib/db";
import { getSecrets } from "@/lib/secrets";

// GET: VAPID public key + whether this endpoint is still active (re-enable prompt).
export async function GET(req: Request) {
  const endpoint = new URL(req.url).searchParams.get("endpoint");
  const sub = endpoint ? await prisma.pushSubscription.findUnique({ where: { endpoint } }) : null;
  return Response.json({ publicKey: getSecrets().vapidPublicKey, known: !!sub, active: sub?.active ?? false });
}

// POST: store this device's subscription (one row per device).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { subscription?: { endpoint: string; keys: { p256dh: string; auth: string } }; label?: string } | null;
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return Response.json({ error: "Invalid subscription" }, { status: 400 });
  const label = (body?.label || "Device").slice(0, 60);
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { endpoint: sub.endpoint, keys: JSON.stringify(sub.keys), deviceLabel: label, active: true },
    update: { keys: JSON.stringify(sub.keys), active: true, lastError: null },
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return Response.json({ ok: true });
}
