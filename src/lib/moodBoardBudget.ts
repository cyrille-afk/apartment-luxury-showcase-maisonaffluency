import { applyTradeDiscount } from "./productPricing";

export const budgetCategories = ["Seating", "Tables", "Lighting", "Storage", "Rugs/Objects"] as const;
export type BudgetCategory = typeof budgetCategories[number];
export type MoodRoomType = "living" | "dining" | "bedroom" | "office";
export const moodCurrencies = ["EUR", "USD", "SGD", "GBP", "CHF"] as const;
export type MoodCurrency = typeof moodCurrencies[number];
export const isMoodCurrency = (v: unknown): v is MoodCurrency => typeof v === "string" && (moodCurrencies as readonly string[]).includes(v);
const moodSymbols: Record<MoodCurrency, string> = { EUR: "€", USD: "$", SGD: "S$", GBP: "£", CHF: "CHF " };
export const moodCurrencySymbol = (c: MoodCurrency) => moodSymbols[c].trim();
/** Whole-unit display with the board currency's own symbol (€, $, S$, £, CHF). */
export function formatMoodMoney(cents: number, currency: MoodCurrency): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}${moodSymbols[currency]}${Math.round(Math.abs(cents) / 100).toLocaleString("en-US")}`;
}
/** Re-express the board's total and caps in another currency so the budget keeps its value. */
export function convertMoodBudget(settings: MoodBudgetSettings, next: MoodCurrency, factor: number): MoodBudgetSettings {
  const conv = (n: number) => Math.round(n * factor);
  return { ...settings, currency: next, totalEur: settings.totalEur == null ? null : conv(settings.totalEur),
    caps: Object.fromEntries(Object.entries(settings.caps).map(([k, v]) => [k, conv(v as number)])) };
}
/** `totalEur` and caps are amounts in `currency` (EUR when unset); the field name is kept for saved drafts. */
export type MoodBudgetSettings = { currency?: MoodCurrency; roomType: MoodRoomType; totalEur: number | null; caps: Partial<Record<BudgetCategory, number>>; anchors: string[] };
export const emptyMoodBudget = (): MoodBudgetSettings => ({ roomType: "living", totalEur: null, caps: {}, anchors: [] });
export type MoodPrice = { retail: number | null; trade: number | null };
export function moodPrices(baseCents: number | null, discount: number): MoodPrice {
  return baseCents != null && baseCents > 0
    ? { retail: baseCents, trade: applyTradeDiscount(baseCents, discount) } : { retail: null, trade: null };
}
export function budgetCategory(item: { product_name?: string; title?: string; category?: string; subcategory?: string }): BudgetCategory {
  const name = `${item.product_name ?? item.title ?? ""} ${item.subcategory ?? ""}`.toLowerCase();
  const classify = (text: string): BudgetCategory | null => /lamp|light|pendant|chandelier|sconce/.test(text) ? "Lighting"
    : /sideboard|console|cabinet|storage|credenza|buffet|shelving|bookcase/.test(text) ? "Storage"
    : /table|desk/.test(text) ? "Tables" : /sofa|chair|seat|bed\b|stool|bench|ottoman|pouf/.test(text) ? "Seating" : null;
  return classify(name) ?? classify((item.category ?? "").toLowerCase()) ?? "Rugs/Objects";
}
export function moodBudgetLedger(items: { id: string; product_name?: string; category?: string; subcategory?: string }[], prices: ReadonlyMap<string, MoodPrice>, settings: MoodBudgetSettings, eurRate = 1) {
  const spent = Object.fromEntries(budgetCategories.map(c => [c, 0])) as Record<BudgetCategory, number>;
  let allocated = 0, unpriced = 0;
  for (const item of items) {
    const eur = prices.get(item.id)?.retail;
    const cents = eur == null ? null : Math.round(eur * eurRate);
    if (cents == null) { unpriced++; continue; }
    allocated += cents; spent[budgetCategory(item)] += cents;
  }
  const total = settings.totalEur == null ? null : Math.round(settings.totalEur * 100);
  return { allocated, remaining: total == null ? null : total - allocated, spent, unpriced, total };
}
export function fitsMoodBudget(item: Parameters<typeof budgetCategory>[0], price: MoodPrice | undefined, ledger: ReturnType<typeof moodBudgetLedger>, settings: MoodBudgetSettings, eurRate = 1) {
  const category = budgetCategory(item), cap = settings.caps[category];
  if (ledger.unpriced && (ledger.total != null || cap != null)) return false;
  if (price?.retail == null) return ledger.total == null && cap == null;
  const cents = Math.round(price.retail * eurRate);
  return (ledger.remaining == null || cents <= ledger.remaining)
    && (cap == null || cents + ledger.spent[category] <= Math.round(cap * 100));
}