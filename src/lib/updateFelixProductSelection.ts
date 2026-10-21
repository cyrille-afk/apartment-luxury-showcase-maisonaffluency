import type { ProactiveTearsheetData } from "@/components/trade/concierge/ProactiveTearsheetCard";

/** Update only an existing, uncommitted card. Never insert or revise exports. */
export function updateFelixProductSelection<T extends { kind: string }>(
  timeline: T[], selection: ProactiveTearsheetData,
): T[] {
  return timeline.map((item) => {
    const card = item as T & { data?: ProactiveTearsheetData; resolved?: string };
    if (card.kind !== "proactive_tearsheet" || card.resolved || card.data?.productId !== selection.productId) return item;
    // The locked photo is a snapshot: live page updates never replace it.
    const lockedImage = card.data.savedImageField ?? card.data.imageUrl;
    return { ...item, data: { ...selection, imageUrl: lockedImage ?? selection.imageUrl, savedImageField: lockedImage ?? selection.savedImageField, lockedAt: card.data.lockedAt, savedQuoteId: card.data.savedQuoteId, savedLineId: card.data.savedLineId, quantity: card.data.quantity ?? selection.quantity ?? 1 } };
  });
}