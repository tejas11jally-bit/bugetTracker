import { isCurrency } from "./money";

const SYMBOLS: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "¥": "JPY", "د.إ": "AED", "AED": "AED", "Dhs": "AED", "DH": "AED" };

/** Shortcuts sends amounts like "AED 45.00", "45,00 €", "$12.50", "1,234.5". */
export function parseAmount(raw: unknown): { value: string | null; currency: string | null } {
  if (typeof raw === "number") return { value: String(Math.abs(raw)), currency: null };
  const text = String(raw ?? "").trim();
  let currency: string | null = null;
  const code = text.match(/\b([A-Z]{3})\b/);
  if (code && isCurrency(code[1])) currency = code[1];
  else for (const [sym, c] of Object.entries(SYMBOLS)) if (text.includes(sym)) currency = c;
  const num = text.replace(/[^\d.,]/g, "");
  if (!num) return { value: null, currency };
  // "1.234,56" or "45,00" → European decimal comma.
  const value = /,\d{1,3}$/.test(num) && !/\.\d{1,3}$/.test(num) ? num.replace(/\./g, "").replace(",", ".") : num.replace(/,/g, "");
  return { value, currency };
}
