"use client";

import { useState, useTransition } from "react";
import { saveSplits } from "@/app/actions/ledger";
import { btn, input } from "@/components/ui";

type Row = { categoryId: number; amount: string };

export default function SplitEditor({ id, currency, total, categories, initial }: { id: number; currency: string; total: string; categories: { id: number; name: string }[]; initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial.length > 1 ? initial : [...initial, { categoryId: 0, amount: "" }]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const left = Math.round((Number(total) - sum) * 1000) / 1000;

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <select value={r.categoryId} onChange={(e) => update(i, { categoryId: Number(e.target.value) })} className={input} aria-label="Category">
            <option value={0}>Category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input value={r.amount} onChange={(e) => update(i, { amount: e.target.value })} inputMode="decimal" placeholder="0.00" className={`${input} w-32`} aria-label="Amount" />
          <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className={btn.ghost} aria-label="Remove line">
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={() => setRows((rs) => [...rs, { categoryId: 0, amount: left > 0 ? String(left) : "" }])} className={btn.ghost}>
          + Add line
        </button>
        <span className={left === 0 ? "text-muted" : "text-amber-700 dark:text-amber-400"}>
          {left === 0 ? "Adds up" : `${currency} ${left.toFixed(2)} ${left > 0 ? "unassigned" : "too much"}`}
        </span>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await saveSplits(id, rows);
            setMsg(res.error ?? "Saved.");
          })
        }
        className={`${btn.primary} self-start`}
      >
        Save split
      </button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
