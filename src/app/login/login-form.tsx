"use client";

import { useActionState, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { loginAction } from "@/app/actions/auth";
import { btn, input } from "@/components/ui";

export default function LoginForm({ next, hasPasskey }: { next: string; hasPasskey: boolean }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  async function passkey() {
    setPasskeyError(null);
    try {
      const options = await fetch("/api/auth/passkey/login-options", { method: "POST" }).then((r) => r.json());
      const response = await startAuthentication({ optionsJSON: options });
      const res = await fetch("/api/auth/passkey/login-verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(response) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Face ID sign-in failed");
      window.location.href = next;
    } catch (e) {
      setPasskeyError(e instanceof Error ? e.message : "Face ID sign-in failed");
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {hasPasskey && (
        <>
          <button type="button" onClick={passkey} className={btn.primary}>
            Sign in with Face ID
          </button>
          {passkeyError && <p className="text-sm text-red-700 dark:text-red-400">{passkeyError}</p>}
          <p className="text-center text-xs text-muted">or use your password</p>
        </>
      )}
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input name="password" type="password" required placeholder="Password" className={input} autoComplete="current-password" autoFocus={!hasPasskey} aria-label="Password" />
        {state?.error && <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
        <button className={hasPasskey ? btn.secondary : btn.primary} disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
