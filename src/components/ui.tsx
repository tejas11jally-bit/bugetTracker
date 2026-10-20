import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/money";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-accent hover:bg-black/5 dark:hover:bg-white/5",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950",
};

export const input =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

export const label = "mb-1 block text-sm font-medium text-muted";

export function Page({ title, actions, children, subtitle }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-32 md:px-8 md:pb-12">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Money({ amount, currency = "AED", sign, className = "", colour }: { amount: number; currency?: string; sign?: boolean; className?: string; colour?: boolean }) {
  const tone = colour ? (amount < 0 ? "text-red-700 dark:text-red-400" : amount > 0 ? "text-emerald-700 dark:text-emerald-400" : "") : "";
  return <span className={`tabular whitespace-nowrap ${tone} ${className}`}>{formatMoney(amount, currency, { sign })}</span>;
}

export function Progress({ value, max, colour }: { value: number; max: number; colour?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : value > 0 ? 100 : 0;
  const over = max >= 0 && value > max;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "#dc2626" : pct >= 80 ? "#d97706" : (colour ?? "var(--accent)") }} />
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "good" | "bad" | "accent" }) {
  const tones = {
    neutral: "bg-black/5 text-muted dark:bg-white/10",
    warn: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    bad: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
    accent: "bg-accent/15 text-accent",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Tabs({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1 dark:bg-white/5" aria-label="Sections">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${i.key === current ? "bg-surface shadow-sm" : "text-muted"}`}
          aria-current={i.key === current ? "page" : undefined}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function Field({ label: text, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
