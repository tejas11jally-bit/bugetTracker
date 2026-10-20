"use client";

import { useState } from "react";
import { reconcile } from "@/app/actions/ledger";
import { formatMoney, toMinor } from "@/lib/money";
import { btn, input } from "@/components/ui";

// F8: shows the gap live and offers the adjustment entry.
export default function Reconcile({ accountId, appBalance, currency, credit }: { accountId: number; appBalance: number; currency: string; credit: boolean }) {
  const [value, setValue] = useState("");
  const typed = toMinor(value || "x", currency);
  const bank = typed == null ? null : credit ? -Math.abs(typed) : typed;
  const gap = bank == null ? null : bank - appBalance;
  const pct = gap == null ? null : (Math.abs(gap) / Math.max(Math.abs(bank!), Math.abs(appBalance), 1)) * 100;

  return (
    <form action={reconcile} className="flex flex-col gap-3">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="appBalance" value={appBalance} />
      {credit && <input type="hidden" name="owed" value="on" />}
      <label>
        <span className="text-sm text-muted">{credit ? "Amount owed per bank" : "Bank balance"} ({currency})</span>
        <input name="bankBalance" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className={input} required />
      </label>
      {gap != null && (
        <p className={`rounded-xl p-3 text-sm ${gap === 0 ? "bg-emerald-100 dark:bg-emerald-950" : "bg-amber-100 dark:bg-amber-950"}`}>
          {gap === 0 ? (
            "Matches exactly."
          ) : (
            <>
              Ledgerly shows {formatMoney(credit ? -appBalance : appBalance, currency)}; the gap is {formatMoney(Math.abs(gap), currency)} ({pct!.toFixed(2)}%). Suggested adjustment: {gap < 0 ? "expense" : "income"} of {formatMoney(Math.abs(gap), currency)}.
            </>
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button name="adjust" value="1" className={btn.primary} disabled={gap == null}>
          {gap ? "Post adjustment and mark reconciled" : "Mark reconciled"}
        </button>
        {!!gap && (
          <button name="adjust" value="0" className={btn.secondary}>
            Record gap only
          </button>
        )}
      </div>
    </form>
  );
}
