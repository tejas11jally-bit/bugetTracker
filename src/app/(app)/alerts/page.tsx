import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { Empty, Page, btn } from "@/components/ui";
import { clearRead, markAllRead } from "@/app/actions/alerts";

const ICON: Record<string, string> = { over_budget: "🔴", budget_80: "🟠", bill_tomorrow: "📅", large_tx: "⚠️", milestone: "🔥" };

export default async function AlertsPage() {
  const user = await prisma.user.findFirstOrThrow();
  const alerts = await prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <Page
      title="Alerts"
      actions={
        <>
          <form action={markAllRead}>
            <button className={btn.secondary}>Mark all read</button>
          </form>
          <form action={clearRead}>
            <button className={btn.secondary}>Clear read</button>
          </form>
        </>
      }
    >
      {alerts.length === 0 ? (
        <Empty>No alerts. You&apos;ll see over-budget, 80% used, bills due tomorrow and unusually large purchases here.</Empty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link href={a.link} className={`flex gap-3 px-4 py-3 ${a.read ? "opacity-60" : ""}`}>
                <span aria-hidden>{ICON[a.type] ?? "•"}</span>
                <span className="flex-1">
                  <span className={`block text-sm ${a.read ? "" : "font-semibold"}`}>{a.message}</span>
                  <span className="text-xs text-muted">{formatDateTime(a.createdAt, user.timezone)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
