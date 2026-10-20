// F23: the 19 supported currencies. decimals = minor units per PRD "Data model".
export const CURRENCIES = {
  AED: { decimals: 2, name: "UAE dirham" },
  USD: { decimals: 2, name: "US dollar" },
  EUR: { decimals: 2, name: "Euro" },
  GBP: { decimals: 2, name: "British pound" },
  INR: { decimals: 2, name: "Indian rupee" },
  SAR: { decimals: 2, name: "Saudi riyal" },
  QAR: { decimals: 2, name: "Qatari riyal" },
  KWD: { decimals: 3, name: "Kuwaiti dinar" },
  OMR: { decimals: 3, name: "Omani rial" },
  BHD: { decimals: 3, name: "Bahraini dinar" },
  JPY: { decimals: 0, name: "Japanese yen" },
  CNY: { decimals: 2, name: "Chinese yuan" },
  CAD: { decimals: 2, name: "Canadian dollar" },
  AUD: { decimals: 2, name: "Australian dollar" },
  CHF: { decimals: 2, name: "Swiss franc" },
  SGD: { decimals: 2, name: "Singapore dollar" },
  PKR: { decimals: 2, name: "Pakistani rupee" },
  PHP: { decimals: 2, name: "Philippine peso" },
  EGP: { decimals: 2, name: "Egyptian pound" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrency(code: string): code is CurrencyCode {
  return code in CURRENCIES;
}

export function decimalsOf(currency: string): number {
  return isCurrency(currency) ? CURRENCIES[currency].decimals : 2;
}

/** "45.5" → 4550 (AED). Accepts "1,234.50". Returns null when not a number. */
export function toMinor(input: string | number, currency: string): number | null {
  const text = String(input).replace(/,/g, "").trim();
  if (!/^-?\d*\.?\d+$/.test(text)) return null;
  return Math.round(Number(text) * 10 ** decimalsOf(currency));
}

export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** decimalsOf(currency);
}

/** Plain number for inputs: 4550 → "45.50". */
export function minorToInput(minor: number, currency: string): string {
  return fromMinor(minor, currency).toFixed(decimalsOf(currency));
}

/** "AED 1,234.50"; negative shows a leading minus. */
export function formatMoney(minor: number, currency = "AED", opts: { sign?: boolean; compact?: boolean } = {}): string {
  const d = decimalsOf(currency);
  const value = Math.abs(fromMinor(minor, currency));
  const digits = opts.compact && value >= 1000 ? 0 : d;
  const body = value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = minor < 0 ? "−" : opts.sign && minor > 0 ? "+" : "";
  return `${sign}${currency} ${body}`;
}

/** AED fils, the base unit for budgets and reports. */
export function formatAED(fils: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  return formatMoney(fils, "AED", opts);
}

/** Convert minor units of `currency` to AED fils at `rate` (AED per 1 unit). */
export function toBase(minor: number, currency: string, rate: number): number {
  return Math.round(fromMinor(minor, currency) * rate * 100);
}
