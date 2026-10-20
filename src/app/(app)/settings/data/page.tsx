import { prisma } from "@/lib/db";
import { listBackups } from "@/lib/backup";
import { getState } from "@/lib/push";
import { formatDateTime } from "@/lib/dates";
import { Card, Page, btn } from "@/components/ui";
import { backupNow } from "@/app/actions/settings";
import ImportCsv from "./import-csv";
import Restore from "./restore";

export default async function DataPage() {
  const user = await prisma.user.findFirstOrThrow();
  const accounts = await prisma.account.findMany({ where: { archived: false } });
  const backups = listBackups();
  const last = await getState("last_backup");
  return (
    <Page title="Import, export & backup">
      <Card title="Export">
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/csv" className={btn.secondary}>
            Transactions (CSV)
          </a>
          <a href="/api/export/json" className={btn.secondary}>
            Full backup (JSON)
          </a>
        </div>
      </Card>

      <Card title="Import CSV">
        <ImportCsv accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
      </Card>

      <Card title="Nightly backups">
        <p className="mb-2 text-sm text-muted">
          A copy of the database is saved to the backup folder every night at 03:00 and kept for 30 days. Last backup: {formatDateTime(last ? new Date(last) : null, user.timezone)}.
        </p>
        <form action={backupNow} className="mb-3">
          <button className={btn.secondary}>Back up now</button>
        </form>
        <ul className="divide-y divide-line text-sm">
          {backups.slice(0, 30).map((b) => (
            <li key={b.name} className="flex justify-between py-1.5">
              <a href={`/api/backup/${b.name}`} className="text-accent underline">
                {b.name}
              </a>
              <span className="text-muted">{(b.size / 1024).toFixed(0)} KB</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">To restore a .db file, follow &ldquo;Restore from a nightly backup&rdquo; in the README.</p>
      </Card>

      <Card title="Restore a JSON backup">
        <Restore />
      </Card>
    </Page>
  );
}
