import { headers } from "next/headers";
import SecureContextCheck from "./secure-context-check";

export const dynamic = "force-dynamic";

// Phase 0 test page: confirms the server is reachable over Tailscale HTTPS.
export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "unknown";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const serverTime = new Date().toLocaleString("en-GB", {
    timeZone: process.env.TZ || "Asia/Dubai",
    dateStyle: "short",
    timeStyle: "medium",
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold">Ledgerly</h1>
      <p className="text-lg">Phase 0: the server is reachable.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-neutral-300 p-4 text-sm dark:border-neutral-700">
        <dt className="font-medium">Host</dt>
        <dd className="break-all">{host}</dd>
        <dt className="font-medium">Protocol</dt>
        <dd>{proto}</dd>
        <dt className="font-medium">Server time</dt>
        <dd>{serverTime}</dd>
        <dt className="font-medium">Secure context</dt>
        <dd>
          <SecureContextCheck />
        </dd>
      </dl>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Pass when Safari shows the lock icon, Host ends in .ts.net, and Secure
        context says Yes, all on mobile data with Wi-Fi off.
      </p>
    </main>
  );
}
