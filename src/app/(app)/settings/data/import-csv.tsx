"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/lib/csv";
import { btn } from "@/components/ui";

const FIELDS = [
  ["date", "Date *"],
  ["amount", "Amount (signed)"],
  ["debit", "Debit / money out"],
  ["credit", "Credit / money in"],
  ["payee", "Payee / description"],
  ["category", "Category"],
  ["account", "Account"],
  ["currency", "Currency"],
  ["note", "Note"],
  ["tags", "Tags"],
] as const;

type Field = (typeof FIELDS)[number][0];

function guess(headers: string[], field: Field) {
  const h = headers.map((x) => x.toLowerCase());
  const hints: Record<Field, string[]> = {
    date: ["date", "posted", "transaction date"],
    amount: ["amount", "value"],
    debit: ["debit", "withdrawal", "money out"],
    credit: ["credit", "deposit", "money in"],
    payee: ["payee", "description", "merchant", "details", "narrative"],
    category: ["category"],
    account: ["account"],
    currency: ["currency", "ccy"],
    note: ["note", "memo"],
    tags: ["tags", "tag"],
  };
  return h.findIndex((x) => hints[field].some((k) => x.includes(k)));
}

export default function ImportCsv({ accounts }: { accounts: { id: number; name: string }[] }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Record<Field, number> | null>(null);
  const [dateOrder, setDateOrder] = useState<"dmy" | "ymd" | "mdy">("dmy");
  const [spendSign, setSpendSign] = useState<"negative" | "positive">("negative");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);
  const [skipDuplicates, setSkip] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onFile(file: File) {
    const parsed = parseCsv(await file.text());
    setRows(parsed);
    setResult(null);
    const headers = parsed[0] ?? [];
    const m = Object.fromEntries(FIELDS.map(([f]) => [f, guess(headers, f)])) as Record<Field, number>;
    if (m.amount >= 0) {
      m.debit = -1;
      m.credit = -1;
    }
    setMapping(m);
  }

  async function run() {
    if (!rows || !mapping) return;
    setBusy(true);
    const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: rows.slice(1), mapping, dateOrder, spendSign, accountId, skipDuplicates }) });
    const json = await res.json();
    setBusy(false);
    setResult(res.ok ? `Imported ${json.imported}, skipped ${json.skipped} duplicates${json.errorCount ? `, ${json.errorCount} rows had errors: ${json.errors.join("; ")}` : ""}.` : json.error);
    router.refresh();
  }

  const headers = rows?.[0] ?? [];
  const sel = "rounded-lg border border-line bg-surface px-2 py-1.5 text-sm";
  return (
    <div className="flex flex-col gap-3">
      <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="text-sm" aria-label="CSV file" />
      {rows && mapping && (
        <>
          <p className="text-sm text-muted">{rows.length - 1} rows. Match each field to a column:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FIELDS.map(([f, label]) => (
              <label key={f} className="text-xs">
                <span className="text-muted">{label}</span>
                <select value={mapping[f]} onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })} className={`${sel} w-full`}>
                  <option value={-1}>—</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <label>
              Dates{" "}
              <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as typeof dateOrder)} className={sel}>
                <option value="dmy">DD/MM/YYYY</option>
                <option value="ymd">YYYY-MM-DD</option>
                <option value="mdy">MM/DD/YYYY</option>
              </select>
            </label>
            {mapping.amount >= 0 && (
              <label>
                Spending is{" "}
                <select value={spendSign} onChange={(e) => setSpendSign(e.target.value as typeof spendSign)} className={sel}>
                  <option value="negative">negative</option>
                  <option value="positive">positive</option>
                </select>
              </label>
            )}
            <label>
              Default account{" "}
              <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} className={sel}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkip(e.target.checked)} /> Skip duplicates
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <tbody>
                {rows.slice(0, 4).map((r, i) => (
                  <tr key={i} className={i === 0 ? "font-semibold" : ""}>
                    {r.map((c, j) => (
                      <td key={j} className="border border-line px-1.5 py-0.5 whitespace-nowrap">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={run} disabled={busy || mapping.date < 0 || (mapping.amount < 0 && mapping.debit < 0 && mapping.credit < 0)} className={`${btn.primary} self-start`}>
            {busy ? "Importing…" : `Import ${rows.length - 1} rows`}
          </button>
        </>
      )}
      {result && <p className="text-sm">{result}</p>}
    </div>
  );
}
