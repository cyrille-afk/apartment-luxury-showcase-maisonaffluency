export type PriceSnapshot = { title?: string; product_name?: string; currency?: string; trade_price_cents?: number | null; price_per_sqm_cents?: number | null; size_variants?: unknown };
export type PriceDifference = { label: string; before: number | null; after: number | null };
const amount = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
function variants(snapshot: PriceSnapshot) {
  const result = new Map<string, number | null>();
  if (!Array.isArray(snapshot.size_variants)) return result;
  snapshot.size_variants.forEach((entry: Record<string, unknown>) => {
    const label = [entry.label, entry.base, entry.top].filter(Boolean).join(" · ") || "Unlabelled option";
    result.set(label, amount(entry.price_cents));
  });
  return result;
}
export function priceDifferences(before: PriceSnapshot, after: PriceSnapshot): PriceDifference[] {
  const changes: PriceDifference[] = [];
  for (const [field, label] of [["trade_price_cents", "Main price"], ["price_per_sqm_cents", "Price / m²"]] as const) {
    const oldValue = amount(before[field]); const newValue = amount(after[field]);
    if (oldValue !== newValue) changes.push({ label, before: oldValue, after: newValue });
  }
  const oldVariants = variants(before); const newVariants = variants(after);
  for (const label of new Set([...oldVariants.keys(), ...newVariants.keys()])) {
    const oldValue = oldVariants.get(label) ?? null; const newValue = newVariants.get(label) ?? null;
    if (oldValue !== newValue) changes.push({ label, before: oldValue, after: newValue });
  }
  return changes;
}
export function priceValue(cents: number | null, currency: string) {
  if (cents === null || cents === 0) return "Price upon Request";
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100); }
  catch { return `${currency} ${(cents / 100).toFixed(2)}`; }
}
export type PriceAttempt = { id: string; userId: string; product: string; currency: string; changes: PriceDifference[]; timestamp: string; status: "Saving" | "Failed" | "Unconfirmed" };
let attempts: PriceAttempt[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
export const subscribePriceAttempts = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getPriceAttempts = () => attempts;
const emptyAttempts: PriceAttempt[] = [];
export const getServerPriceAttempts = (): PriceAttempt[] => emptyAttempts;
export function startPriceAttempt(attempt: Omit<PriceAttempt, "id" | "timestamp" | "status">) {
  const id = crypto.randomUUID();
  const row: PriceAttempt = { ...attempt, id, timestamp: new Date().toISOString(), status: "Saving" };
  attempts = [row, ...attempts].slice(0, 100);
  emit(); return id;
}
export function finishPriceAttempt(id: string, status: "Saved" | "Failed" | "Unconfirmed") {
  attempts = status === "Saved" ? attempts.filter((row) => row.id !== id) : attempts.map((row) => row.id === id ? { ...row, status } : row);
  emit();
}