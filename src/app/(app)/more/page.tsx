import Link from "next/link";
import { Page } from "@/components/ui";
import { logoutAction } from "@/app/actions/auth";

const LINKS = [
  { href: "/bills", label: "Bills & goals", icon: "▦" },
  { href: "/review", label: "Review & weekly summary", icon: "✓" },
  { href: "/reports", label: "Reports", icon: "▥" },
  { href: "/accounts", label: "Accounts & net worth", icon: "▭" },
  { href: "/alerts", label: "Alerts", icon: "🔔" },
  { href: "/settings", label: "Settings", icon: "⚙" },
  { href: "/onboarding", label: "Install & setup guide", icon: "📲" },
];

export default function MorePage() {
  return (
    <Page title="More">
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center gap-3 px-4 py-3.5">
              <span className="w-6 text-center" aria-hidden>
                {l.icon}
              </span>
              <span className="flex-1">{l.label}</span>
              <span className="text-muted" aria-hidden>
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={logoutAction}>
        <button className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left text-red-700 dark:text-red-400">Sign out</button>
      </form>
    </Page>
  );
}
