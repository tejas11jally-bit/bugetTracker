"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/settings";
import { btn, input } from "./ui";

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="password" name="current" placeholder="Current password" className={input} autoComplete="current-password" required aria-label="Current password" />
      <input type="password" name="next" placeholder="New password (10+ characters)" className={input} autoComplete="new-password" required minLength={10} aria-label="New password" />
      <button className={`${btn.secondary} self-start`} disabled={pending}>
        Change password
      </button>
      {state?.error && <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700 dark:text-emerald-400">{state.ok}</p>}
    </form>
  );
}
