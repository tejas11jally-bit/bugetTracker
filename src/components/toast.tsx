"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Toast = { id: number; text: string; tone: "ok" | "error" | "info" };
const Ctx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 4000);
  }, []);

  // Offline entries synced in the background.
  useEffect(() => {
    const onSynced = (e: Event) => show(`Synced ${(e as CustomEvent<number>).detail} offline entr${(e as CustomEvent<number>).detail === 1 ? "y" : "ies"}.`, "info");
    window.addEventListener("ledgerly:synced", onSynced);
    return () => window.removeEventListener("ledgerly:synced", onSynced);
  }, [show]);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-safe" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto mt-3 max-w-md rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.tone === "error" ? "bg-red-700 text-white" : t.tone === "info" ? "bg-slate-800 text-white" : "bg-accent text-white"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
