import { prisma } from "./db";
import { ensureReminders } from "./reminders";

export const STARTER_CATEGORIES: { name: string; group: string; icon: string; colour: string }[] = [
  { name: "Groceries", group: "Essentials", icon: "🛒", colour: "#16a34a" },
  { name: "Rent", group: "Essentials", icon: "🏠", colour: "#0f766e" },
  { name: "Utilities", group: "Essentials", icon: "💡", colour: "#ca8a04" },
  { name: "Transport", group: "Essentials", icon: "🚕", colour: "#2563eb" },
  { name: "Fuel", group: "Essentials", icon: "⛽", colour: "#9333ea" },
  { name: "Phone & internet", group: "Essentials", icon: "📶", colour: "#0891b2" },
  { name: "Health", group: "Essentials", icon: "💊", colour: "#dc2626" },
  { name: "Insurance", group: "Essentials", icon: "🛡️", colour: "#475569" },
  { name: "Dining out", group: "Lifestyle", icon: "🍽️", colour: "#ea580c" },
  { name: "Coffee", group: "Lifestyle", icon: "☕", colour: "#92400e" },
  { name: "Shopping", group: "Lifestyle", icon: "🛍️", colour: "#db2777" },
  { name: "Entertainment", group: "Lifestyle", icon: "🎬", colour: "#7c3aed" },
  { name: "Travel", group: "Lifestyle", icon: "✈️", colour: "#0284c7" },
  { name: "Subscriptions", group: "Lifestyle", icon: "🔁", colour: "#4f46e5" },
  { name: "Gifts", group: "Lifestyle", icon: "🎁", colour: "#e11d48" },
  { name: "Personal care", group: "Lifestyle", icon: "💇", colour: "#c026d3" },
  { name: "Emergency fund", group: "Savings", icon: "🧯", colour: "#059669" },
  { name: "Savings", group: "Savings", icon: "🏦", colour: "#047857" },
  { name: "Salary", group: "Income", icon: "💼", colour: "#15803d" },
  { name: "Other income", group: "Income", icon: "➕", colour: "#65a30d" },
];

export const CATEGORY_GROUPS = ["Essentials", "Lifestyle", "Savings", "Income"] as const;

export async function seedStarterData(opts: { categories: boolean }) {
  if (opts.categories && (await prisma.category.count()) === 0) {
    let i = 0;
    for (const c of STARTER_CATEGORIES) await prisma.category.create({ data: { ...c, sortOrder: i++ } });
  }
  await ensureReminders();
}
