import type { Goal } from "@prisma/client";
import { daysBetween } from "./dates";

// F25: 14 starter templates plus custom. Amounts are suggestions in AED.
export const GOAL_TEMPLATES: { key: string; name: string; icon: string; suggested: number; months: number; hint: string }[] = [
  { key: "emergency_fund", name: "Emergency fund", icon: "🧯", suggested: 30000, months: 12, hint: "3–6 months of essential spending" },
  { key: "travel", name: "Travel", icon: "✈️", suggested: 8000, months: 6, hint: "Flights, hotel and spending money" },
  { key: "car", name: "Car", icon: "🚗", suggested: 60000, months: 24, hint: "Down payment or full purchase" },
  { key: "wedding", name: "Wedding", icon: "💍", suggested: 80000, months: 18, hint: "Venue, attire, guests" },
  { key: "pay_off_credit_card", name: "Pay off credit card", icon: "💳", suggested: 10000, months: 6, hint: "Link the card account to track the balance" },
  { key: "home_deposit", name: "Home down payment", icon: "🏡", suggested: 200000, months: 48, hint: "UAE mortgages need 20% or more down" },
  { key: "education", name: "Education", icon: "🎓", suggested: 40000, months: 24, hint: "Course fees or school fees" },
  { key: "new_phone", name: "New phone", icon: "📱", suggested: 4500, months: 6, hint: "Pay cash instead of instalments" },
  { key: "laptop", name: "Laptop", icon: "💻", suggested: 6000, months: 6, hint: "Work or study machine" },
  { key: "gifts", name: "Gifts and Eid", icon: "🎁", suggested: 3000, months: 6, hint: "Seasonal gifts and celebrations" },
  { key: "medical", name: "Medical buffer", icon: "🩺", suggested: 5000, months: 12, hint: "Costs insurance does not cover" },
  { key: "moving", name: "Moving costs", icon: "📦", suggested: 10000, months: 6, hint: "Deposit, agency fee, movers" },
  { key: "loan_payoff", name: "Pay off a loan", icon: "📉", suggested: 25000, months: 18, hint: "Personal or car loan" },
  { key: "pilgrimage", name: "Hajj or Umrah", icon: "🕋", suggested: 20000, months: 24, hint: "Package and travel costs" },
];

export function templateFor(key: string) {
  return GOAL_TEMPLATES.find((t) => t.key === key);
}

/** F12: monthly contribution needed to hit target by target date. */
export function goalProgress(goal: Goal, saved: number, todayDate: string) {
  const remaining = Math.max(goal.targetAmount - saved, 0);
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((saved / goal.targetAmount) * 100)) : 0;
  let monthly: number | null = null;
  let monthsLeft: number | null = null;
  if (goal.targetDate) {
    monthsLeft = Math.max(1, Math.ceil(daysBetween(todayDate, goal.targetDate) / 30.44));
    monthly = Math.ceil(remaining / monthsLeft);
  }
  return { remaining, pct, monthly, monthsLeft, done: remaining === 0 };
}
