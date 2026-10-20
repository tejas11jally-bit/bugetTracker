export const dynamic = "force-dynamic";

const startedAt = new Date().toISOString();

export function GET() {
  return Response.json({
    status: "ok",
    startedAt,
    now: new Date().toISOString(),
    timezone: process.env.TZ ?? "unset",
  });
}
