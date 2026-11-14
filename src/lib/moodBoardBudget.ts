import { applyTradeDiscount } from "./productPricing";

export const budgetCategories = ["Seating", "Tables", "Lighting", "Storage", "Rugs/Objects"] as const;
export type BudgetCategory = typeof budgetCategories[number];
export type MoodRoomType = "living" | "dining" | "bedroom" | "office";
export type MoodBudgetSettings = { roomType: MoodRoomType; totalEur: number | null; caps: Partial<Record<BudgetCategory, number>>; anchors: string[] };
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
export function moodBudgetLedger(items: { id: string; product_name?: string; category?: string; subcategory?: string }[], prices: ReadonlyMap<string, MoodPrice>, settings: MoodBudgetSettings) {
  const spent = Object.fromEntries(budgetCategories.map(c => [c, 0])) as Record<BudgetCategory, number>;
  let allocated = 0, unpriced = 0;
  for (const item of items) {
    const cents = prices.get(item.id)?.retail;
    if (cents == null) { unpriced++; continue; }
    allocated += cents; spent[budgetCategory(item)] += cents;
  }
  const total = settings.totalEur == null ? null : Math.round(settings.totalEur * 100);
  return { allocated, remaining: total == null ? null : total - allocated, spent, unpriced, total };
}
export function fitsMoodBudget(item: Parameters<typeof budgetCategory>[0], price: MoodPrice | undefined, ledger: ReturnType<typeof moodBudgetLedger>, settings: MoodBudgetSettings) {
  const category = budgetCategory(item), cap = settings.caps[category];
  if (ledger.unpriced && (ledger.total != null || cap != null)) return false;
  if (price?.retail == null) return ledger.total == null && cap == null;
  return (ledger.remaining == null || price.retail <= ledger.remaining)
    && (cap == null || price.retail + ledger.spent[category] <= Math.round(cap * 100));
}