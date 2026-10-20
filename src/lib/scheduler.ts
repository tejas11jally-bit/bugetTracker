import cron from "node-cron";
import { ensureReminders, tick } from "./reminders";
import { setState } from "./push";

const g = globalThis as unknown as { ledgerlyScheduler?: boolean };

export async function startScheduler() {
  if (g.ledgerlyScheduler) return;
  g.ledgerlyScheduler = true;
  try {
    await ensureReminders();
    await setState("server_started", new Date().toISOString());
  } catch (e) {
    // Database not migrated yet (first boot in dev). The next tick retries.
    console.error("[scheduler] init", e);
  }
  cron.schedule("* * * * *", () => void tick());
  setTimeout(() => void tick(), 5_000);
  console.log("[scheduler] started");
}
