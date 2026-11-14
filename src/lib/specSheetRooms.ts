export const GENERAL_ROOM = "General";
export const DEFAULT_SPEC_ROOMS = ["Living Room", "Dining Room", "Master Suite", "Study", "Outdoor", GENERAL_ROOM] as const;

export type SpecRoomRecord = {
  id: string;
  name: string;
  project_id: string | null;
  budget_cents: number | null;
  currency: string;
  position: number;
};

export type SpecRoomAssignment = { quote_item_id: string; room_id: string };
export type SpecRoomItem = {
  item_id: string;
  inherited_room?: string | null;
  quantity: number;
  client_price_cents: number | null;
  currency: string;
};
export type SpecCurrencyTotal = { currency: string; cents: number };

export function normalizeSpecRoomName(value?: string | null): string {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 60);
}

export function specRoomName(
  item: Pick<SpecRoomItem, "item_id" | "inherited_room">,
  assignments: SpecRoomAssignment[],
  rooms: SpecRoomRecord[],
): string {
  const roomId = assignments.find(a => a.quote_item_id === item.item_id)?.room_id;
  const assigned = rooms.find(room => room.id === roomId)?.name;
  return normalizeSpecRoomName(assigned) || normalizeSpecRoomName(item.inherited_room) || GENERAL_ROOM;
}

/** Standard rooms lead, followed by inherited/custom rooms alphabetically; empty custom rooms remain available. */
export function specRoomNames<T extends Pick<SpecRoomItem, "item_id" | "inherited_room">>(
  items: T[],
  rooms: SpecRoomRecord[],
  assignments: SpecRoomAssignment[] = [],
): string[] {
  const present = new Set(items.map(item => specRoomName(item, assignments, rooms)));
  rooms.forEach(room => { const name = normalizeSpecRoomName(room.name); if (name) present.add(name); });
  const standard = DEFAULT_SPEC_ROOMS.filter(name => present.has(name));
  const extras = [...present]
    .filter(name => !(DEFAULT_SPEC_ROOMS as readonly string[]).includes(name))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return [...standard, ...extras];
}

export function groupSpecItems<T>(
  items: T[],
  roomNames: string[],
  roomFor: (item: T) => string,
): { name: string; items: T[] }[] {
  return roomNames
    .map(name => ({ name, items: items.filter(item => roomFor(item) === name) }))
    .filter(group => group.items.length > 0);
}

/** Sums quantity × client unit price independently per currency; unknown prices never become zero. */
export function sumSpecClientTotals<T extends Pick<SpecRoomItem, "quantity" | "client_price_cents" | "currency">>(items: T[]): SpecCurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (typeof item.client_price_cents !== "number" || item.client_price_cents <= 0) continue;
    const currency = String(item.currency || "EUR").toUpperCase();
    const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    totals.set(currency, (totals.get(currency) || 0) + item.client_price_cents * quantity);
  }
  return [...totals].map(([currency, cents]) => ({ currency, cents }));
}

export function unpricedSpecItemCount<T extends Pick<SpecRoomItem, "client_price_cents">>(items: T[]): number {
  return items.filter(item => typeof item.client_price_cents !== "number" || item.client_price_cents <= 0).length;
}

export function specRoomBudgetStatus(
  totals: SpecCurrencyTotal[],
  budgetCents: number | null | undefined,
  budgetCurrency: string,
): { kind: "remaining" | "over"; cents: number } | null {
  if (budgetCents == null || totals.length !== 1 || totals[0].currency !== budgetCurrency.toUpperCase()) return null;
  const difference = budgetCents - totals[0].cents;
  return difference >= 0 ? { kind: "remaining", cents: difference } : { kind: "over", cents: -difference };
}

/** Empty input clears a budget; undefined means the entered value is invalid. */
export function parseSpecRoomBudget(value: string): number | null | undefined {
  const normalized = value.trim().replace(/\s/g, "").replace(/,/g, "");
  if (!normalized) return null;
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) return undefined;
  return Math.round(amount * 100);
}
