"use client";

import { useEffect, useState } from "react";
import { isIos, isStandalone } from "./push-setup";

// Onboarding: 3-step Home Screen install guide, shown on iPhone in Safari.
export default function InstallGuide() {
  const [mode, setMode] = useState<"ios" | "installed" | "other" | null>(null);
  useEffect(() => setMode(isStandalone() ? "installed" : isIos() ? "ios" : "other"), []);
  if (mode === null) return null;
  if (mode === "installed") return <p className="text-sm">✓ Installed. You opened Ledgerly from the Home Screen.</p>;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {mode === "other" && <p className="text-muted">Open this page in Safari on your iPhone to install it. On desktop, use your browser&apos;s &ldquo;Install app&rdquo; option if you want a window.</p>}
      <ol className="flex flex-col gap-2">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">1</span>
          <span>
            Tap the <strong>Share</strong> button <span aria-hidden>(□↑)</span> in Safari&apos;s toolbar.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">2</span>
          <span>
            Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">3</span>
          <span>
            Close Safari and open <strong>Ledgerly</strong> from the Home Screen icon. Reminders only work from there.
          </span>
        </li>
      </ol>
    </div>
  );
}
