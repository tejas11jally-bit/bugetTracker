import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, Page, btn } from "@/components/ui";
import { revokeApiToken } from "@/app/actions/settings";
import TokenForm from "./token-form";

export default async function ShortcutsPage() {
  const user = await prisma.user.findFirstOrThrow();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "ledgerly.your-tailnet.ts.net";
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  const [tokens, categories] = await Promise.all([
    prisma.apiToken.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.category.findMany({ where: { archived: false, group: { not: "Income" } }, orderBy: [{ sortOrder: "asc" }] }),
  ]);
  const url = `${base}/api/ingest`;

  return (
    <Page title="Shortcuts & tokens" subtitle="Log purchases without opening the app.">
      <Card title="1. Create a token">
        <p className="mb-3 text-sm text-muted">Each Shortcut uses its own token. Ledgerly only stores a hash, so copy it when it&apos;s shown.</p>
        <TokenForm />
        {tokens.length > 0 && (
          <ul className="mt-4 divide-y divide-line text-sm">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {t.label} {t.revoked && <Badge tone="bad">Revoked</Badge>}
                  <span className="block text-xs text-muted">Last used {formatDateTime(t.lastUsedAt, user.timezone)}</span>
                </span>
                {!t.revoked && (
                  <form action={revokeApiToken}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className={btn.ghost}>Revoke</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="2. Apple Pay capture (iOS 17+)">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Open <strong>Shortcuts</strong> → <strong>Automation</strong> → <strong>+</strong> → <strong>Transaction</strong> (under Wallet).
          </li>
          <li>Choose your cards, keep <strong>When I tap</strong>, select <strong>Run Immediately</strong>, then <strong>Next</strong> → <strong>New Blank Automation</strong>.</li>
          <li>
            Add <strong>Get Contents of URL</strong>. Set URL to <code className="rounded bg-black/5 px-1 break-all dark:bg-white/10">{url}</code>.
          </li>
          <li>
            Tap <strong>Show More</strong>: Method <strong>POST</strong>. Add header <code>Authorization</code> = <code>Bearer YOUR_TOKEN</code>.
          </li>
          <li>
            Request Body <strong>JSON</strong>, add fields:
            <ul className="mt-1 list-disc pl-5">
              <li>
                <code>amount</code> (Text) → tap and pick <em>Shortcut Input</em> → <em>Amount</em>
              </li>
              <li>
                <code>merchant</code> (Text) → <em>Shortcut Input</em> → <em>Merchant</em>
              </li>
              <li>
                <code>card</code> (Text) → <em>Shortcut Input</em> → <em>Card or Pass</em>
              </li>
              <li>
                <code>source</code> (Text) → <code>apple_pay</code>
              </li>
            </ul>
          </li>
          <li>Optional: add <strong>Show Notification</strong> with <em>Contents of URL</em> to see &ldquo;Logged AED 45.00 · Groceries&rdquo;.</li>
          <li>Pay with Apple Pay. The purchase appears in Review within seconds. Confirming or correcting the category teaches Ledgerly that merchant.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">Name a Ledgerly account after the card (for example &ldquo;Visa&rdquo;) so purchases land in the right account. Tailscale must be connected on the iPhone (VPN On Demand).</p>
      </Card>

      <Card title="3. Quick Log shortcut (Home Screen or Action Button)">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            In Shortcuts, tap <strong>+</strong> and name it <strong>Log expense</strong>.
          </li>
          <li>
            Add <strong>Ask for Input</strong>: type <strong>Number</strong>, prompt &ldquo;Amount?&rdquo;.
          </li>
          <li>
            Add <strong>List</strong> with your categories (copy below), then <strong>Choose from List</strong>.
          </li>
          <li>
            Add <strong>Get Contents of URL</strong>: same URL, POST, same Authorization header. JSON body: <code>amount</code> → <em>Provided Input</em>, <code>category</code> → <em>Chosen Item</em>,{" "}
            <code>source</code> → <code>quick_log</code>.
          </li>
          <li>
            Add <strong>Show Notification</strong> with <em>Contents of URL</em>.
          </li>
          <li>
            Share → <strong>Add to Home Screen</strong>, or Settings → <strong>Action Button</strong> → Shortcut → Log expense.
          </li>
        </ol>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-black/5 p-3 text-xs dark:bg-white/5">{categories.map((c) => c.name).join("\n")}</pre>
      </Card>

      <Card title="Test from a computer">
        <pre className="overflow-x-auto rounded-xl bg-black/5 p-3 text-xs dark:bg-white/5">{`curl -X POST ${url} \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":"AED 45.00","merchant":"Carrefour","source":"apple_pay"}'`}</pre>
      </Card>
    </Page>
  );
}
