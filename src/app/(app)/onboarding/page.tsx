import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, Page, btn, input } from "@/components/ui";
import InstallGuide from "@/components/install-guide";
import PushSetup from "@/components/push-setup";
import { saveReminder } from "@/app/actions/settings";

export default async function Onboarding() {
  const daily = await prisma.reminder.findUnique({ where: { type: "daily_log" } });
  const time = daily ? (JSON.parse(daily.schedule).time as string) : "21:00";
  return (
    <Page title="Set up your phone" subtitle="Four steps to your first logged purchase.">
      <Card title="1. Install on your Home Screen">
        <div id="install">
          <InstallGuide />
        </div>
      </Card>
      <Card title="2. Turn on reminders">
        <PushSetup compact />
      </Card>
      <Card title="3. Daily reminder time">
        <form action={saveReminder} className="flex items-end gap-2">
          <input type="hidden" name="type" value="daily_log" />
          <input type="hidden" name="enabled" value="on" />
          <input type="time" name="time" defaultValue={time} className={`${input} w-36`} aria-label="Daily reminder time" />
          <button className={btn.secondary}>Save</button>
        </form>
        <p className="mt-2 text-xs text-muted">The other reminders (bills, weekly review, month close) are in Settings → Reminders.</p>
      </Card>
      <Card title="4. Log your first purchase">
        <p className="text-sm text-muted">Type something like <code className="rounded bg-black/5 px-1 dark:bg-white/10">32 @coffee</code> and press enter.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/add" className={btn.primary}>
            Quick add
          </Link>
          <Link href="/settings/shortcuts" className={btn.secondary}>
            Optional: Apple Pay shortcut
          </Link>
          <Link href="/" className={btn.ghost}>
            Go to dashboard
          </Link>
        </div>
      </Card>
    </Page>
  );
}
