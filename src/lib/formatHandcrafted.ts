/**
 * Shared formatter for the "Handcrafted in {origin} in {lead_time}" spec row
 * shown on both PublicProductPage and TradeProductPage.
 *
 * Strips redundant prefixes ("Handmade in", "Made in", "Ships in", etc.) so
 * database values like "Handmade in Thailand" + "Ships in 20-24 weeks" render
 * cleanly as "Handcrafted in Thailand in 20-24 weeks".
 */
const ORIGIN_PREFIX_RE = /^\s*(handmade|handcrafted|made)\s+in\s+/i;
const LEAD_TIME_PREFIX_RE = /^\s*ships?\s+in\s+/i;

export function formatHandcrafted(
  origin: string | null | undefined,
  leadTime: string | null | undefined,
): string | null {
  const cleanOrigin = origin?.replace(ORIGIN_PREFIX_RE, "").trim();
  const cleanLead = leadTime?.replace(LEAD_TIME_PREFIX_RE, "").trim();

  if (cleanOrigin && cleanLead) return `Handcrafted in ${cleanOrigin} in ${cleanLead}`;
  if (cleanOrigin) return `Handcrafted in ${cleanOrigin}`;
  if (cleanLead) return cleanLead;
  return null;
}
