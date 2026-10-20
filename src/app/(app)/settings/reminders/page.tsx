import { prisma } from "@/lib/db";
import { REMINDER_DEFAULTS, type Schedule } from "@/lib/reminders";
import { formatDateTime, today } from "@/lib/dates";
import { Badge, Card, Page, btn, input } from "@/components/ui";
import PushSetup from "@/components/push-setup";
import { removeDevice, renameDevice, resetReminder, saveReminder, testNotification } from "@/app/actions/settings";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function RemindersPage() {
  const user = await prisma.user.findFirstOrThrow();
  const [reminders, devices, log] = await Promise.all([
    prisma.reminder.findMany(),
    prisma.pushSubscription.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.pushLog.findMany({ where: { kind: { not: "test" } }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const sentToday = log.filter((l) => l.date === today(user.timezone)).length;
  const attempted = log.length;
  const delivered = log.filter((l) => l.delivered > 0).length;

  return (
    <Page title="Reminders & devices" subtitle={`Quiet hours ${user.quietHoursStart}–${user.quietHoursEnd} · max ${user.maxPushesPerDay} per day (${sentToday} sent today)`}>
      <Card title="This device">
        <PushSetup compact />
      </Card>

      <Card title="Devices">
        {devices.length === 0 ? (
          <p className="text-sm text-muted">No devices yet. Open Ledgerly from your iPhone Home Screen and enable reminders.</p>
        ) : (
          <ul className="divide-y divide-line">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <form action={renameDevice} className="flex gap-1">
                    <input type="hidden" name="id" value={d.id} />
                    <input name="label" defaultValue={d.deviceLabel} className="w-36 rounded-lg border border-line bg-surface px-2 py-1 text-sm" aria-label="Device name" />
                    <button className={btn.ghost}>Rename</button>
                  </form>
                  {d.active ? <Badge tone="good">Active</Badge> : <Badge tone="bad">Inactive: re-enable on that device</Badge>}
                </div>
                <p className="text-xs text-muted">
                  Last delivered {formatDateTime(d.lastSuccessAt, user.timezone)}
                  {d.lastError && ` · last error: ${d.lastError}`}
                </p>
                <div className="flex gap-2">
                  <form action={testNotification}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className={btn.secondary}>Send test notification</button>
                  </form>
                  <form action={removeDevice}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className={btn.ghost}>Remove</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Schedules">
        <ul className="divide-y divide-line">
          {REMINDER_DEFAULTS.map((def) => {
            const r = reminders.find((x) => x.type === def.type);
            if (!r) return null;
            const s = JSON.parse(r.schedule) as Schedule;
            return (
              <li key={r.type} className="py-3">
                <form action={saveReminder} className="flex flex-col gap-2">
                  <input type="hidden" name="type" value={r.type} />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 font-medium">
                      <input type="checkbox" name="enabled" defaultChecked={r.enabled} className="h-4 w-4" /> {def.label}
                    </label>
                    <span className="text-xs text-muted">Opens: {def.opens}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {s.time !== undefined && <input type="time" name="time" defaultValue={s.time} className={`${input} w-32`} aria-label={`${def.label} time`} />}
                    {s.days && (
                      <fieldset className="flex flex-wrap gap-1">
                        <legend className="sr-only">Days</legend>
                        {DAYS.map((d, i) => (
                          <label key={d} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs">
                            <input type="checkbox" name="days" value={i} defaultChecked={s.days!.includes(i)} /> {d}
                          </label>
                        ))}
                      </fieldset>
                    )}
                    {s.lastDay && <span className="text-xs text-muted">on the last day of each month</span>}
                    {s.daysBefore && <span className="text-xs text-muted">the day before a bill is due</span>}
                    {s.hours !== undefined && (
                      <label className="flex items-center gap-1">
                        after <input type="number" name="hours" min={12} defaultValue={s.hours} className={`${input} w-20`} /> hours with no entry or check-in
                      </label>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button className={btn.secondary}>Save</button>
                    <button formAction={resetReminder} className={btn.ghost}>
                      Reset
                    </button>
                    <span className="self-center text-xs text-muted">Last sent {formatDateTime(r.lastSentAt, user.timezone)}</span>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Delivery log">
        <p className="mb-2 text-sm">
          {attempted === 0 ? "No reminders sent yet." : `${delivered} of the last ${attempted} reminders reached at least one device (${Math.round((delivered / attempted) * 100)}%). Target: 95%.`}
        </p>
        <ul className="divide-y divide-line text-xs">
          {log.slice(0, 15).map((l) => (
            <li key={l.id} className="flex justify-between py-1.5">
              <span>
                {formatDateTime(l.createdAt, user.timezone)} · {l.title}
              </span>
              <span className={l.delivered ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                {l.delivered} sent{l.failed ? `, ${l.failed} failed` : ""}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  );
}
