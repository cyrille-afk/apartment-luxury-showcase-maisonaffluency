export type PriceSnapshot = { title?: string; product_name?: string; currency?: string; price_prefix?: string | null; trade_price_cents?: number | null; price_per_sqm_cents?: number | null; size_variants?: unknown };
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
    if ((oldValue ?? 0) !== (newValue ?? 0)) changes.push({ label, before: oldValue, after: newValue });
  }
  const oldVariants = variants(before); const newVariants = variants(after);
  for (const label of new Set([...oldVariants.keys(), ...newVariants.keys()])) {
    const oldValue = oldVariants.get(label) ?? null; const newValue = newVariants.get(label) ?? null;
    if ((oldValue ?? 0) !== (newValue ?? 0)) changes.push({ label, before: oldValue, after: newValue });
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
export type DurablePriceAttempt = { id: string; user_id: string; product_name: string; created_at: string; completed_at: string | null; status: "Saving" | "Saved" | "Failed" | "Unconfirmed"; old_data: PriceSnapshot; new_data: PriceSnapshot };
export type PriceHistoryFilter = "all" | "saved" | "pending" | "failed";
export const PRICE_HISTORY_FILTER_LABELS: Record<PriceHistoryFilter, string> = { all: "All", saved: "Saved", pending: "Pending", failed: "Failed" };
// A save the browser never saw a reply for is pending, not failed and not saved.
const PENDING_STATUSES = new Set(["Saving", "Unconfirmed"]);
export function matchesPriceHistoryFilter(status: string, filter: PriceHistoryFilter) {
  if (filter === "all") return true;
  if (filter === "saved") return status === "Saved";
  if (filter === "pending") return PENDING_STATUSES.has(status);
  return status === "Failed";
}
export function priceHistoryCounts<T extends { status: string }>(rows: T[]): Record<PriceHistoryFilter, number> {
  return {
    all: rows.length,
    saved: rows.filter((row) => matchesPriceHistoryFilter(row.status, "saved")).length,
    pending: rows.filter((row) => matchesPriceHistoryFilter(row.status, "pending")).length,
    failed: rows.filter((row) => matchesPriceHistoryFilter(row.status, "failed")).length,
  };
}
export function durableAttemptRows(records: DurablePriceAttempt[]) {
  return records.filter((row) => row.status !== "Saved").map((row) => ({
    id: row.id, userId: row.user_id, product: row.product_name,
    currency: row.new_data.currency ?? row.old_data.currency ?? "EUR",
    timestamp: row.completed_at ?? row.created_at,
    // A disconnected browser cannot establish whether an unfinished request committed.
    status: row.status === "Saving" ? "Unconfirmed" as const : row.status,
    changes: priceDifferences(row.old_data, row.new_data),
  }));
}