import type { ProactiveTearsheetData } from "@/components/trade/concierge/ProactiveTearsheetCard";

export function felixQuantity(value: number = 1): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

export function felixLineCents(data: ProactiveTearsheetData): number | null {
  return typeof data.unitPriceCents === "number" && data.unitPriceCents > 0
    ? Math.round(data.unitPriceCents) * felixQuantity(data.quantity) : null;
}

export function felixQuoteTotals(cards: ProactiveTearsheetData[]) {
  const totals = new Map<string, { currency: string; cents: number; incomplete: boolean }>();
  for (const card of cards) {
    const currency = card.priceCurrency;
    if (!currency) continue;
    const total = totals.get(currency) ?? { currency, cents: 0, incomplete: false };
    const line = felixLineCents(card);
    total.cents += line ?? 0;
    total.incomplete ||= line === null;
    totals.set(currency, total);
  }
  return [...totals.values()];
}

export function formatFelixMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}