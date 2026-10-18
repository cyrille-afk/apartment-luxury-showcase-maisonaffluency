import { pairingHistoryChanges } from "./curatedPairingHistory";

export type HistoryFilters = { product: string; admin: string; from: string; to: string; media: string };
export const emptyHistoryFilters: HistoryFilters = { product: "all", admin: "all", from: "", to: "", media: "all" };
export type FilterableHistory = {
  actor_id: string | null;
  created_at: string;
  before_values: unknown;
  after_values: unknown;
};

export function historySnapshot(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function historyMediaChanges(before: Record<string, unknown> | null, after: Record<string, unknown> | null, media: string) {
  return pairingHistoryChanges(before, after).filter(change => media === "all" ||
    (media === "photos" && change.field.endsWith(" · product photo")) ||
    (media === "textures" && change.field.endsWith(" · macro texture")) ||
    (media === "images" && (change.field.endsWith(" · product photo") || change.field.endsWith(" · macro texture"))));
}

export function filterPairingHistory<T extends FilterableHistory>(entries: T[], filters: HistoryFilters): T[] {
  const start = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
  const end = filters.to ? new Date(`${filters.to}T00:00:00`) : null;
  if (end) end.setDate(end.getDate() + 1);
  return entries.filter(entry => {
    const before = historySnapshot(entry.before_values);
    const after = historySnapshot(entry.after_values);
    if (filters.product !== "all" && before?.preferred_pick_id !== filters.product && after?.preferred_pick_id !== filters.product) return false;
    if (filters.admin !== "all" && (entry.actor_id || "unknown") !== filters.admin) return false;
    const time = new Date(entry.created_at).getTime();
    if (start !== null && time < start) return false;
    if (end && time >= end.getTime()) return false;
    return filters.media === "all" || historyMediaChanges(before, after, filters.media).length > 0;
  });
}