import assert from "node:assert/strict";
import { parseQuickAdd } from "@/lib/quick-add";
import { parseAmount } from "@/lib/ingest";
import { toMinor, toBase, formatAED } from "@/lib/money";

const q = parseQuickAdd("45 @groceries Carrefour");
assert.equal(q.amount, "45"); assert.equal(q.category, "groceries"); assert.equal(q.payee, "Carrefour"); assert.equal(q.income, false);
const u = parseQuickAdd("20 USD @coffee");
assert.equal(u.currency, "USD"); assert.equal(u.amount, "20");
assert.equal(parseQuickAdd("USD20 @coffee").currency, "USD");
assert.equal(parseQuickAdd("+5000 @salary").income, true);
const t = parseQuickAdd("12.5 @dining-out Zuma #work #Team !cash note: client lunch");
assert.deepEqual([t.amount, t.category, t.payee, t.tags, t.account, t.note], ["12.5", "dining out", "Zuma", ["work", "team"], "cash", "client lunch"]);
assert.equal(parseQuickAdd("1,250 @rent").amount, "1250");

assert.deepEqual(parseAmount("AED 45.00"), { value: "45.00", currency: "AED" });
assert.deepEqual(parseAmount("12,50 €"), { value: "12.50", currency: "EUR" });
assert.deepEqual(parseAmount("$1,234.56"), { value: "1234.56", currency: "USD" });
assert.deepEqual(parseAmount("1.234,56 EUR"), { value: "1234.56", currency: "EUR" });
assert.deepEqual(parseAmount(18), { value: "18", currency: null });

assert.equal(toMinor("1.234", "KWD"), 1234); assert.equal(toMinor("500", "JPY"), 500); assert.equal(toMinor("45.5", "AED"), 4550);
assert.equal(toBase(-2000, "USD", 3.6725), -7345);
assert.equal(formatAED(-123456), "−AED 1,234.56");
console.log("parse tests: all passed");
