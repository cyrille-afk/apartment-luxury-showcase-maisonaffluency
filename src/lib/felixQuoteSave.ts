import type { ProactiveTearsheetData } from "@/components/trade/concierge/ProactiveTearsheetCard";
import { felixQuantity } from "./felixQuoteQuantity";
export function prepareFelixQuote(cards: ProactiveTearsheetData[], quoteId: string) {
  return cards.map(card => ({ ...card, savedQuoteId: quoteId,
    savedLineId: card.savedQuoteId === quoteId && card.savedLineId ? card.savedLineId : crypto.randomUUID(),
    quantity: felixQuantity(card.quantity),
    unitPriceCents: typeof card.unitPriceCents === "number" && card.unitPriceCents > 0 ? Math.round(card.unitPriceCents) : null,
  }));
}