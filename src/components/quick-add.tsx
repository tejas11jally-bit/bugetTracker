"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseQuickAdd, matchByName } from "@/lib/quick-add";
import { CURRENCY_CODES } from "@/lib/money";
import { enqueue } from "@/lib/offline-queue";
import { useToast } from "./toast";
import { btn, input } from "./ui";

export type QACategory = { id: number; name: string; icon: string; group: string };
export type QAAccount = { id: number; name: string; currency: string; type: string };
export type QuickAddData = { categories: QACategory[]; recentIds: number[]; accounts: QAAccount[]; defaultAccountId: number | null; today: string };

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Shared submit: optimistic toast, offline queue on network failure. */
function useSubmit(onDone: () => void) {
  const toast = useToast();
  return async (body: Record<string, unknown>) => {
    const clientId = uuid();
    onDone();
    try {
      const res = await fetch("/api/transactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, clientId }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error ?? "Could not save.", "error");
        return false;
      }
      toast(json.toast ?? "Saved.");
      return true;
    } catch {
      await enqueue({ clientId, body, queuedAt: Date.now() });
      toast("Saved offline. It will sync when you're back online.", "info");
      return true;
    }
  };
}

export function QuickAdd({ data, standalone = false, onClose }: { data: QuickAddData; standalone?: boolean; onClose?: () => void }) {
  const [mode, setMode] = useState<"line" | "form">("line");
  const router = useRouter();
  const toast = useToast();

  const finish = () => {
    if (standalone) setTimeout(() => router.push("/"), 900);
    else {
      onClose?.();
      router.refresh();
    }
  };

  async function nothingToday() {
    const res = await fetch("/api/checkin", { method: "POST" }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    toast(json.toast ?? "Checked in.");
    finish();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/5" role="tablist">
        {(["line", "form"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${mode === m ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {m === "line" ? "Type it" : "Keypad"}
          </button>
        ))}
      </div>
      {mode === "line" ? <LineEntry data={data} onSaved={finish} /> : <FormEntry data={data} onSaved={finish} />}
      <button type="button" onClick={nothingToday} className={`${btn.secondary} w-full`}>
        Nothing to log today
      </button>
    </div>
  );
}

function LineEntry({ data, onSaved }: { data: QuickAddData; onSaved: () => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const submit = useSubmit(() => setText(""));
  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const category = matchByName(data.categories, parsed.category);
  const account = matchByName(data.accounts, parsed.account) ?? data.accounts.find((a) => a.id === data.defaultAccountId) ?? data.accounts[0];

  useEffect(() => ref.current?.focus(), []);

  // Suggest categories while typing "@…".
  const atWord = text.match(/@([^\s]*)$/)?.[1];
  const suggestions = atWord !== undefined ? data.categories.filter((c) => c.name.toLowerCase().replace(/\s/g, "").includes(atWord.toLowerCase())).slice(0, 8) : [];
  const recent = data.recentIds.map((id) => data.categories.find((c) => c.id === id)).filter(Boolean) as QACategory[];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed.amount) return;
    if (await submit({ text })) onSaved();
  }

  function pick(c: QACategory) {
    const slug = c.name.toLowerCase().replace(/\s+/g, "-");
    setText((t) => (/@[^\s]*$/.test(t) ? t.replace(/@[^\s]*$/, `@${slug} `) : `${t.trim()} @${slug} `.trimStart()));
    ref.current?.focus();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="45 @groceries Carrefour"
        className={`${input} py-3.5 text-lg`}
        autoComplete="off"
        autoCapitalize="off"
        enterKeyHint="done"
        aria-label="Type a purchase"
      />
      <div className="flex min-h-7 flex-wrap gap-1.5 text-xs">
        {parsed.amount ? (
          <>
            <Chip>
              {parsed.income ? "Income" : "Expense"} {parsed.currency ?? account?.currency} {parsed.amount}
            </Chip>
            <Chip tone={parsed.category && !category ? "bad" : undefined}>{category ? `${category.icon} ${category.name}` : parsed.category ? `No match: ${parsed.category}` : "Category: auto"}</Chip>
            {parsed.payee && <Chip>{parsed.payee}</Chip>}
            <Chip>{account?.name}</Chip>
            {parsed.tags.map((t) => (
              <Chip key={t}>#{t}</Chip>
            ))}
          </>
        ) : (
          <span className="text-muted">Amount, then @category and payee. Add a currency code (20 USD), +income, #tag or !account.</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(suggestions.length ? suggestions : recent).map((c) => (
          <button type="button" key={c.id} onClick={() => pick(c)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">
            {c.icon} {c.name}
          </button>
        ))}
      </div>
      <button className={`${btn.primary} w-full py-3 text-base`} disabled={!parsed.amount}>
        Save
      </button>
    </form>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "bad" }) {
  return <span className={`rounded-full px-2 py-1 ${tone === "bad" ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" : "bg-accent/15 text-accent"}`}>{children}</span>;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

function FormEntry({ data, onSaved }: { data: QuickAddData; onSaved: () => void }) {
  const defaultAccount = data.accounts.find((a) => a.id === data.defaultAccountId) ?? data.accounts[0];
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState(defaultAccount?.id ?? 0);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [currency, setCurrency] = useState(defaultAccount?.currency ?? "AED");
  const [date, setDate] = useState(data.today);
  const [payee, setPayee] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [more, setMore] = useState(false);
  const submit = useSubmit(() => {
    setAmount("");
    setCategoryId(null);
    setPayee("");
    setNote("");
    setTags("");
  });

  const pool = data.categories.filter((c) => (type === "income" ? c.group === "Income" : c.group !== "Income"));
  const recent = data.recentIds.map((id) => pool.find((c) => c.id === id)).filter(Boolean) as QACategory[];
  const shown = showAll ? pool : recent.length >= 3 ? recent : pool.slice(0, 6);

  function key(k: string) {
    setAmount((a) => {
      if (k === "⌫") return a.slice(0, -1);
      if (k === "." && a.includes(".")) return a;
      if (/\.\d{3}$/.test(a)) return a;
      return a === "0" && k !== "." ? k : a + k;
    });
  }

  async function save() {
    if (!amount || Number(amount) <= 0) return;
    const ok = await submit({ amount, type, categoryId, accountId, transferAccountId: toAccountId, currency, date, payee, note, tags });
    if (ok) onSaved();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-black/5 p-1 text-sm dark:bg-white/5">
        {(["expense", "income", "transfer"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={`flex-1 rounded-lg py-1.5 capitalize ${type === t ? "bg-surface font-semibold shadow-sm" : "text-muted"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl border border-line bg-surface px-2 py-3 text-base" aria-label="Currency">
          {CURRENCY_CODES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          inputMode="none"
          placeholder="0"
          className="tabular w-full rounded-xl border border-line bg-surface px-3 py-2 text-right text-3xl font-semibold"
          aria-label="Amount"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </div>
      <div className="grid grid-cols-3 gap-1.5 md:hidden">
        {KEYS.map((k) => (
          <button key={k} type="button" onClick={() => key(k)} className="rounded-xl bg-black/5 py-3 text-xl font-medium active:bg-black/15 dark:bg-white/5 dark:active:bg-white/15">
            {k}
          </button>
        ))}
      </div>

      {type === "transfer" ? (
        <div className="grid grid-cols-2 gap-2">
          <AccountSelect label="From" accounts={data.accounts} value={accountId} onChange={setAccountId} />
          <AccountSelect label="To" accounts={data.accounts.filter((a) => a.id !== accountId)} value={toAccountId ?? 0} onChange={setToAccountId} placeholder="Choose" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              aria-pressed={categoryId === c.id}
              className={`rounded-full border px-3 py-1.5 text-sm ${categoryId === c.id ? "border-accent bg-accent text-white" : "border-line"}`}
            >
              {c.icon} {c.name}
            </button>
          ))}
          <button type="button" onClick={() => setShowAll((s) => !s)} className={btn.ghost}>
            {showAll ? "Fewer" : "All categories"}
          </button>
        </div>
      )}

      <button type="button" onClick={save} className={`${btn.primary} w-full py-3 text-base`} disabled={!amount || (type === "transfer" && !toAccountId)}>
        Save
      </button>

      <button type="button" onClick={() => setMore((m) => !m)} className={btn.ghost} aria-expanded={more}>
        {more ? "Hide details" : "Account, date, payee, note, tags"}
      </button>
      {more && (
        <div className="grid grid-cols-2 gap-2">
          {type !== "transfer" && <AccountSelect label="Account" accounts={data.accounts} value={accountId} onChange={(id) => { setAccountId(id); setCurrency(data.accounts.find((a) => a.id === id)?.currency ?? currency); }} />}
          <label className="text-sm">
            <span className="text-muted">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          <input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Payee" className={`${input} col-span-2`} aria-label="Payee" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className={input} aria-label="Note" />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" className={input} aria-label="Tags" />
        </div>
      )}
    </div>
  );
}

function AccountSelect({ label, accounts, value, onChange, placeholder }: { label: string; accounts: QAAccount[]; value: number; onChange: (id: number) => void; placeholder?: string }) {
  return (
    <label className="text-sm">
      <span className="text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={input}>
        {placeholder && <option value={0}>{placeholder}</option>}
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.currency})
          </option>
        ))}
      </select>
    </label>
  );
}
