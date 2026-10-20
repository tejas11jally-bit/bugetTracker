import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickAddData } from "@/lib/quick-add-data";
import Shell from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const [qa, unread, review] = await Promise.all([
    quickAddData(),
    prisma.alert.count({ where: { read: false } }),
    prisma.transaction.count({ where: { status: "review", parentId: null } }),
  ]);
  return (
    <Shell quickAdd={qa} unread={unread} review={review}>
      {children}
    </Shell>
  );
}
