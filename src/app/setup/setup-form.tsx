"use client";

import { useActionState } from "react";
import { setupAction } from "@/app/actions/auth";
import { btn, input, label } from "@/components/ui";
import { CURRENCY_CODES } from "@/lib/money";

const DEFAULT_ACCOUNTS = [
  { name: "Cash", type: "cash" },
  { name: "Debit card", type: "debit" },
  { name: "Credit card", type: "credit" },
  { name: "", type: "savings" },
];

export default function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 font-semibold">You</legend>
        <label>
          <span className={label}>Name</span>
          <input name="name" required className={input} autoComplete="name" />
        </label>
        <label>
          <span className={label}>Email</span>
          <input name="email" type="email" required className={input} autoComplete="email" />
        </label>
        <label>
          <span className={label}>Password (10+ characters)</span>
          <input name="password" type="password" required minLength={10} className={input} autoComplete="new-password" />
        </label>
        <label>
          <span className={label}>Time zone</span>
          <input name="timezone" defaultValue="Asia/Dubai" className={input} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="starter" defaultChecked className="h-4 w-4" /> Add starter categories (Groceries, Rent, Coffee…)
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 font-semibold">Accounts and balances</legend>
        <p className="text-sm text-muted">Enter today&apos;s balance. For credit cards, enter the amount you owe. Leave a name blank to skip it.</p>
        {DEFAULT_ACCOUNTS.map((a, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_1fr]">
            <input name={`acc${i}_name`} defaultValue={a.name} placeholder="Account name" className={input} aria-label="Account name" />
            <select name={`acc${i}_type`} defaultValue={a.type} className={input} aria-label="Type">
              <option value="cash">Cash</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit card</option>
              <option value="savings">Savings</option>
            </select>
            <select name={`acc${i}_currency`} defaultValue="AED" className={input} aria-label="Currency">
              {CURRENCY_CODES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input name={`acc${i}_balance`} inputMode="decimal" placeholder="0.00" className={input} aria-label="Balance" />
          </div>
        ))}
      </fieldset>

      {state?.error && <p className="rounded-xl bg-red-100 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{state.error}</p>}
      <button className={btn.primary} disabled={pending}>
        {pending ? "Setting up…" : "Create my ledger"}
      </button>
    </form>
  );
}
