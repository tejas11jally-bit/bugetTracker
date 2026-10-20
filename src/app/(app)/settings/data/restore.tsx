"use client";

import { useState } from "react";
import { btn, input } from "@/components/ui";

export default function Restore() {
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!file) return;
    setBusy(true);
    const res = await fetch("/api/restore", { method: "POST", headers: { "content-type": "application/json" }, body: await file.text() });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(json.error);
    setMsg(`Restored ${json.transactions} transactions and ${json.accounts} accounts. Signing you in again…`);
    setTimeout(() => (window.location.href = "/login"), 1500);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">Replaces all data with the backup. A snapshot of the current database is saved to the backup folder first.</p>
      <input type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" aria-label="Backup file" />
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type RESTORE to confirm" className={input} aria-label="Confirm" />
      <button onClick={run} disabled={!file || confirm !== "RESTORE" || busy} className={`${btn.danger} self-start`}>
        {busy ? "Restoring…" : "Restore"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
