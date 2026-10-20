// Starts the in-process scheduler once per server start (PRD "Tech stack": node-cron, every minute).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.LEDGERLY_SCHEDULER !== "off") {
    const { startScheduler } = await import("./lib/scheduler");
    await startScheduler();
  }
}
