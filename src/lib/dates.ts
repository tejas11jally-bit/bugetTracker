// Date helpers. Calendar dates are "YYYY-MM-DD" strings in the user's time zone,
// so they never shift when the server and the phone disagree about UTC.

export const DEFAULT_TZ = "Asia/Dubai";

type Parts = { date: string; year: number; month: number; day: number; hour: number; minute: number; dow: number };

export function zonedParts(at: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const year = Number(p.year);
  const month = Number(p.month);
  const day = Number(p.day);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    year,
    month,
    day,
    hour: Number(p.hour),
    minute: Number(p.minute),
    dow: dows.indexOf(p.weekday),
  };
}

export function today(tz = DEFAULT_TZ): string {
  return zonedParts(new Date(), tz).date;
}

export function currentMonth(tz = DEFAULT_TZ): string {
  return today(tz).slice(0, 7);
}

/** The UTC instant of local `date` at `time` ("HH:MM") in `tz`. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Offset of tz at the guessed instant; repeat once to settle across DST edges.
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(ts), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    ts = guess - (asUtc - ts);
  }
  return new Date(ts);
}

function toDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
}

export function dayOfWeek(date: string): number {
  return toDate(date).getUTCDay();
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function lastDayOfMonth(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Add months to a date, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsToDate(date: string, n: number, anchorDay?: number): string {
  const month = addMonths(date.slice(0, 7), n);
  const day = Math.min(anchorDay ?? Number(date.slice(8, 10)), daysInMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** DD/MM/YYYY per PRD locale. */
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function shortMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
}

/** Accepts DD/MM/YYYY, D/M/YY, YYYY-MM-DD. Returns YYYY-MM-DD or null. */
export function parseDateInput(text: string): string | null {
  const t = text.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export function formatDateTime(at: Date | null | undefined, tz = DEFAULT_TZ): string {
  if (!at) return "Never";
  const p = zonedParts(at, tz);
  return `${formatDate(p.date)} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
