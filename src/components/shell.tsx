"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ToastProvider } from "./toast";
import { QuickAdd, type QuickAddData } from "./quick-add";
import { Icon } from "./icons";

const NAV = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/transactions", label: "Transactions", icon: "list" },
  { href: "/budget", label: "Budget", icon: "budget" },
  { href: "/bills", label: "Bills & goals", icon: "bills" },
  { href: "/reports", label: "Reports", icon: "reports" },
  { href: "/accounts", label: "Accounts", icon: "accounts" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const TABS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/transactions", label: "Activity", icon: "list" },
  { href: "#add", label: "Add", icon: "+" },
  { href: "/budget", label: "Budget", icon: "budget" },
  { href: "/more", label: "More", icon: "more" },
];

function active(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export default function Shell(props: { children: ReactNode; quickAdd: QuickAddData; unread: number; review: number }) {
  return (
    <ToastProvider>
      <ShellInner {...props} />
    </ToastProvider>
  );
}

function ShellInner({ children, quickAdd, unread, review }: { children: ReactNode; quickAdd: QuickAddData; unread: number; review: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // "n" opens quick add on desktop; Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "?add=1" opens quick add (read directly; useSearchParams would need a Suspense boundary around the page).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add") === "1") setOpen(true);
  }, [path]);

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Ledgerly
          </Link>
          <Bell unread={unread} />
        </div>
        <button onClick={() => setOpen(true)} className="mb-4 rounded-xl bg-accent px-4 py-2.5 text-left text-sm font-semibold text-white">
          + Quick add <kbd className="float-right opacity-70">N</kbd>
        </button>
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(path, n.href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active(path, n.href) ? "bg-accent/10 font-semibold text-accent" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              <Icon name={n.icon} size={18} />
              {n.label}
              {n.href === "/transactions" && review > 0 && <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">{review}</span>}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-background/90 px-4 py-2 pt-safe backdrop-blur md:hidden">
          <Link href="/" className="text-lg font-bold">
            Ledgerly
          </Link>
          <Bell unread={unread} />
        </div>
        <main>{children}</main>
      </div>

      <button
        onClick={() => setOpen(true)}
        className="fixed right-6 bottom-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl text-white shadow-xl md:flex"
        aria-label="Quick add"
      >
        +
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur md:hidden" aria-label="Tabs">
        <ul className="grid grid-cols-5">
          {TABS.map((t) =>
            t.href === "#add" ? (
              <li key={t.href} className="flex justify-center">
                <button onClick={() => setOpen(true)} className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl text-white shadow-lg" aria-label="Quick add">
                  +
                </button>
              </li>
            ) : (
              <li key={t.href}>
                <Link href={t.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(path, t.href) ? "font-semibold text-accent" : "text-muted"}`} aria-current={active(path, t.href) ? "page" : undefined}>
                  <span className="relative" aria-hidden>
                    <Icon name={t.icon} size={22} />
                    {t.href === "/transactions" && review > 0 && <span className="absolute -top-1 -right-2 h-2 w-2 rounded-full bg-amber-500" />}
                  </span>
                  {t.label}
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Quick add" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-4 pb-safe shadow-2xl md:max-w-lg md:rounded-3xl md:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Quick add</h2>
              <button onClick={() => setOpen(false)} className="rounded-full px-3 py-1 text-sm text-muted hover:bg-black/5" aria-label="Close">
                Close
              </button>
            </div>
            <QuickAdd data={quickAdd} onClose={() => setOpen(false)} />
            <div className="h-4" />
          </div>
        </div>
      )}
    </div>
  );
}

function Bell({ unread }: { unread: number }) {
  return (
    <Link href="/alerts" className="relative rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/5" aria-label={`Alerts${unread ? `, ${unread} unread` : ""}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold text-white">{unread}</span>}
    </Link>
  );
}
