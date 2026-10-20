"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { btn } from "./ui";

type State = "loading" | "unsupported" | "install-first" | "denied" | "off" | "on" | "inactive";

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "Browser";
}

export function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Notification permission is only requested from a button tap inside the installed app (iOS rule). */
export default function PushSetup({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(isIos() && !isStandalone() ? "install-first" : "unsupported");
        return;
      }
      if (isIos() && !isStandalone()) return setState("install-first");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return setState("off");
      const status = await fetch(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`).then((r) => r.json());
      setState(status.active ? "on" : "inactive");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await fetch("/api/push").then((r) => r.json());
      const old = await reg.pushManager.getSubscription();
      if (old) await old.unsubscribe();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), label: deviceLabel() }) });
      if (!res.ok) throw new Error("Server rejected the subscription");
      setState("on");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable notifications");
    }
  }

  const text: Record<State, string> = {
    loading: "Checking…",
    unsupported: "This browser can't receive push notifications.",
    "install-first": "On iPhone, add Ledgerly to your Home Screen and open it from the icon first. Then enable reminders there.",
    denied: "Notifications are blocked. iPhone: Settings → Notifications → Ledgerly → Allow. Then come back.",
    off: "Reminders are off on this device.",
    on: "Reminders are on for this device.",
    inactive: "This device stopped receiving reminders. Turn them back on.",
  };

  return (
    <div className={`flex flex-col gap-2 ${compact ? "" : "rounded-xl border border-line p-3"}`}>
      <p className={`text-sm ${state === "inactive" || state === "denied" ? "font-medium text-amber-700 dark:text-amber-400" : ""}`}>{text[state]}</p>
      {(state === "off" || state === "inactive") && (
        <button onClick={enable} className={`${btn.primary} self-start`}>
          {state === "inactive" ? "Re-enable reminders" : "Enable reminders"}
        </button>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
