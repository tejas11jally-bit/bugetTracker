"use client";

import { useActionState } from "react";
import { createApiToken } from "@/app/actions/settings";
import { btn, input } from "@/components/ui";

export default function TokenForm() {
  const [state, action, pending] = useActionState(createApiToken, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input name="label" placeholder="Apple Pay iPhone" className={input} aria-label="Token label" />
        <button className={btn.primary} disabled={pending}>
          Create
        </button>
      </div>
      {state?.token && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-1 font-medium">Token for {state.label}. Copy it now; it won&apos;t be shown again.</p>
          <code className="block break-all select-all">{state.token}</code>
          <button type="button" className={`${btn.ghost} mt-1`} onClick={() => navigator.clipboard?.writeText(state.token!)}>
            Copy
          </button>
        </div>
      )}
    </form>
  );
}
