import { prisma } from "./db";
import { CURRENCY_CODES } from "./money";
import { today } from "./dates";

// Approximate AED per unit, used only until the first successful daily fetch.
// Gulf currencies are pegged to USD, so their values are stable.
const FALLBACK_RATES: Record<string, number> = {
  AED: 1,
  USD: 3.6725,
  SAR: 0.9793,
  QAR: 1.0089,
  KWD: 11.95,
  OMR: 9.5385,
  BHD: 9.7407,
  EUR: 4.0,
  GBP: 4.7,
  INR: 0.042,
  JPY: 0.024,
  CNY: 0.51,
  CAD: 2.6,
  AUD: 2.4,
  CHF: 4.4,
  SGD: 2.8,
  PKR: 0.013,
  PHP: 0.063,
  EGP: 0.075,
};

export type RateInfo = { rate: number; source: "base" | "auto" | "manual" | "fallback"; date: string | null };

/** AED per 1 unit of `currency` on `date`, or the last known rate before it. */
export async function getRate(currency: string, date: string): Promise<RateInfo> {
  if (currency === "AED") return { rate: 1, source: "base", date };
  const row = await prisma.fxRate.findFirst({
    where: { currency, date: { lte: date } },
    orderBy: { date: "desc" },
  });
  if (row) return { rate: row.rateToAed, source: row.source as "auto" | "manual", date: row.date };
  // A transaction dated before the first fetch: use the earliest known rate.
  const later = await prisma.fxRate.findFirst({ where: { currency }, orderBy: { date: "asc" } });
  if (later) return { rate: later.rateToAed, source: later.source as "auto" | "manual", date: later.date };
  return { rate: FALLBACK_RATES[currency] ?? 1, source: "fallback", date: null };
}

export async function getAllRates(date: string): Promise<Record<string, RateInfo>> {
  const out: Record<string, RateInfo> = {};
  for (const c of CURRENCY_CODES) out[c] = await getRate(c, date);
  return out;
}

/** Daily fetch from open.er-api.com (free, no key, covers AED). Manual rates are never overwritten. */
export async function fetchDailyRates(): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/AED", { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { ok: false, count: 0, error: `HTTP ${res.status}` };
    const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (body.result !== "success" || !body.rates) return { ok: false, count: 0, error: "Bad response" };
    const date = today();
    let count = 0;
    for (const c of CURRENCY_CODES) {
      if (c === "AED") continue;
      const perAed = body.rates[c];
      if (!perAed) continue;
      const existing = await prisma.fxRate.findUnique({ where: { date_currency: { date, currency: c } } });
      if (existing?.source === "manual") continue;
      await prisma.fxRate.upsert({
        where: { date_currency: { date, currency: c } },
        create: { date, currency: c, rateToAed: 1 / perAed, source: "auto" },
        update: { rateToAed: 1 / perAed, source: "auto" },
      });
      count++;
    }
    return { ok: true, count };
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setManualRate(currency: string, date: string, rateToAed: number) {
  await prisma.fxRate.upsert({
    where: { date_currency: { date, currency } },
    create: { date, currency, rateToAed, source: "manual" },
    update: { rateToAed, source: "manual" },
  });
}
