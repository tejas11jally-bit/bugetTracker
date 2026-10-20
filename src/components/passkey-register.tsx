"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { btn } from "./ui";

export default function PasskeyRegister() {
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  async function register() {
    setMsg(null);
    try {
      const options = await fetch("/api/auth/passkey/register-options", { method: "POST" }).then((r) => r.json());
      const response = await startRegistration({ optionsJSON: options });
      const label = /iPhone/.test(navigator.userAgent) ? "iPhone" : /Mac/.test(navigator.userAgent) ? "Mac" : "Passkey";
      const res = await fetch("/api/auth/passkey/register-verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ response, label }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMsg("Face ID sign-in is on.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not add passkey");
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={register} className={`${btn.secondary} self-start`}>
        Add Face ID / passkey
      </button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
