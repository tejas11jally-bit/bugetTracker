import { prisma } from "@/lib/db";

// Getting-started checklist (F28): the app was opened from the Home Screen.
export async function POST() {
  const user = await prisma.user.findFirst();
  if (user && !user.appInstalledAt) await prisma.user.update({ where: { id: user.id }, data: { appInstalledAt: new Date() } });
  return Response.json({ ok: true });
}
