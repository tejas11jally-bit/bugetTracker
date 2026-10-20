"use client";

import { useEffect } from "react";
import { flushQueue } from "@/lib/offline-queue";

export default function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Quick add entries saved offline are sent when the connection returns.
    void flushQueue();
    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    // Getting-started checklist: record that the app was opened from the Home Screen.
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) {
      try {
        if (!localStorage.getItem("ledgerly-installed")) {
          fetch("/api/installed", { method: "POST" })
            .then((r) => r.ok && localStorage.setItem("ledgerly-installed", "1"))
            .catch(() => {});
        }
      } catch {
        // storage unavailable
      }
    }
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return null;
}
