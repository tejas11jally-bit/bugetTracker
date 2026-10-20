import { prisma } from "@/lib/db";
import { checkin } from "@/lib/ledger";
import { today } from "@/lib/dates";

// F26 "Nothing today" keeps the streak.
export async function POST() {
  const user = await prisma.user.findFirstOrThrow();
  const streak = await checkin(today(user.timezone), "nothing_today");
  return Response.json({ ok: true, streak, toast: `Checked in. ${streak}-day streak.` });
}
