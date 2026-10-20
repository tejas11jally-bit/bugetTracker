import { isCurrency } from "./money";

// F1 one-line quick add grammar:
//   45 @groceries Carrefour          expense, category "groceries", payee "Carrefour"
//   20 USD @coffee                   optional currency code before or after the amount
//   +5000 @salary Acme               leading "+" = income
//   12.5 @lunch #work note: team     #tags; "note:" starts the note
//   300 !cash @groceries             !account selects an account by name prefix
export type ParsedQuickAdd = {
  amount: string | null;
  income: boolean;
  currency: string | null;
  category: string | null;
  account: string | null;
  payee: string;
  tags: string[];
  note: string;
};

export function parseQuickAdd(input: string): ParsedQuickAdd {
  let text = input.trim();
  let note = "";
  const noteIdx = text.toLowerCase().indexOf("note:");
  if (noteIdx >= 0) {
    note = text.slice(noteIdx + 5).trim();
    text = text.slice(0, noteIdx).trim();
  }

  const out: ParsedQuickAdd = { amount: null, income: false, currency: null, category: null, account: null, payee: "", tags: [], note };
  const payee: string[] = [];

  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const token = raw.trim();
    if (out.amount === null && /^[+-]?\d[\d,]*(\.\d+)?$/.test(token)) {
      out.income = token.startsWith("+");
      out.amount = token.replace(/^[+-]/, "").replace(/,/g, "");
      continue;
    }
    // "20USD" or "USD20"
    const glued = token.match(/^([A-Za-z]{3})(\d[\d,]*(?:\.\d+)?)$|^(\d[\d,]*(?:\.\d+)?)([A-Za-z]{3})$/);
    if (out.amount === null && glued) {
      const code = (glued[1] ?? glued[4]).toUpperCase();
      if (isCurrency(code)) {
        out.currency = code;
        out.amount = (glued[2] ?? glued[3]).replace(/,/g, "");
        continue;
      }
    }
    if (!out.currency && /^[A-Za-z]{3}$/.test(token) && isCurrency(token.toUpperCase()) && payee.length === 0) {
      out.currency = token.toUpperCase();
      continue;
    }
    if (token.startsWith("@") && token.length > 1 && !out.category) {
      out.category = token.slice(1).replace(/[-_]/g, " ");
      continue;
    }
    if (token.startsWith("!") && token.length > 1 && !out.account) {
      out.account = token.slice(1).replace(/[-_]/g, " ");
      continue;
    }
    if (token.startsWith("#") && token.length > 1) {
      out.tags.push(token.slice(1).toLowerCase());
      continue;
    }
    payee.push(token);
  }
  out.payee = payee.join(" ");
  return out;
}

/** Best match by exact name, then prefix, then substring (case-insensitive). */
export function matchByName<T extends { name: string }>(items: T[], query: string | null): T | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();
  return (
    items.find((i) => i.name.toLowerCase() === q) ??
    items.find((i) => i.name.toLowerCase().startsWith(q)) ??
    items.find((i) => i.name.toLowerCase().includes(q)) ??
    items.find((i) => i.name.toLowerCase().replace(/[^a-z]/g, "").startsWith(q.replace(/[^a-z]/g, "")))
  );
}
