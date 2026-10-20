import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { Card, Field, Page, btn, input } from "@/components/ui";
import PasskeyRegister from "@/components/passkey-register";
import PasswordForm from "@/components/password-form";
import { deletePasskey, saveAppearance, saveProfile } from "@/app/actions/settings";
import { logoutAction } from "@/app/actions/auth";

const SECTIONS = [
  { href: "/settings/reminders", label: "Reminders & devices", desc: "Schedules, test notification, per-device status" },
  { href: "/settings/shortcuts", label: "Shortcuts & tokens", desc: "Apple Pay capture and Quick Log setup" },
  { href: "/settings/categories", label: "Categories", desc: "Names, groups, icons, colours" },
  { href: "/accounts", label: "Accounts", desc: "Balances, credit cards, reconcile" },
  { href: "/settings/rules", label: "Merchant rules", desc: "Auto-categorisation learned from your corrections" },
  { href: "/settings/rates", label: "Exchange rates", desc: "Daily rates to AED and manual overrides" },
  { href: "/settings/data", label: "Import, export & backup", desc: "CSV, full JSON backup and restore, nightly backups" },
];

const ACCENTS = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0f172a"];

export default async function SettingsPage() {
  const user = await prisma.user.findFirstOrThrow();
  const passkeys = await prisma.passkey.findMany();
  return (
    <Page title="Settings">
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1">
                <span className="block font-medium">{s.label}</span>
                <span className="text-xs text-muted">{s.desc}</span>
              </span>
              <span className="text-muted" aria-hidden>
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Card title="Profile and notifications">
        <form action={saveProfile} className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input name="name" defaultValue={user.name} className={input} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={user.email} className={input} />
          </Field>
          <Field label="Time zone">
            <input name="timezone" defaultValue={user.timezone} className={input} />
          </Field>
          <Field label="Week starts">
            <select name="weekStart" defaultValue={user.weekStart} className={input}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
              <option value={6}>Saturday</option>
            </select>
          </Field>
          <Field label="Quiet hours from">
            <input type="time" name="quietStart" defaultValue={user.quietHoursStart} className={input} />
          </Field>
          <Field label="Quiet hours until">
            <input type="time" name="quietEnd" defaultValue={user.quietHoursEnd} className={input} />
          </Field>
          <Field label="Max pushes per day">
            <input type="number" name="maxPushes" min={1} max={10} defaultValue={user.maxPushesPerDay} className={input} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <input type="checkbox" name="pushShowAmounts" defaultChecked={user.pushShowAmounts} className="h-4 w-4" /> Show amounts in notifications
          </label>
          <div className="col-span-2">
            <button className={btn.primary}>Save</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted">Base currency: AED. Dates are shown as DD/MM/YYYY.</p>
      </Card>

      <Card title="Appearance">
        <form action={saveAppearance} className="flex flex-col gap-3">
          <fieldset className="flex gap-2">
            <legend className="sr-only">Theme</legend>
            {["system", "light", "dark"].map((t) => (
              <label key={t} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm capitalize">
                <input type="radio" name="theme" value={t} defaultChecked={user.theme === t} /> {t}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="mb-1 text-sm text-muted">Accent colour</legend>
            {ACCENTS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="accent" value={c} defaultChecked={user.accent === c} className="peer sr-only" />
                <span className="block h-8 w-8 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2" style={{ background: c }} aria-label={c} />
              </label>
            ))}
          </fieldset>
          <button className={`${btn.primary} self-start`}>Apply</button>
        </form>
      </Card>

      <Card title="Sign-in">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">Face ID (passkey)</p>
            {passkeys.length > 0 && (
              <ul className="mb-2 divide-y divide-line text-sm">
                {passkeys.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-1.5">
                    <span>
                      {p.label} <span className="text-xs text-muted">· last used {formatDateTime(p.lastUsedAt, user.timezone)}</span>
                    </span>
                    <form action={deletePasskey}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className={btn.ghost}>Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <PasskeyRegister />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Password</p>
            <PasswordForm />
          </div>
          <form action={logoutAction}>
            <button className={btn.danger}>Sign out</button>
          </form>
        </div>
      </Card>
    </Page>
  );
}
