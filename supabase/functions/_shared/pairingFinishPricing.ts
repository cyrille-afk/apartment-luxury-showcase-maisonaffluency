export interface PairingFinishOption { id: string; name: string; price_cents: number | null }
export interface PairingReference { ruleId: string; optionId: string }
export const PAIRING_FINISH_CURRENCIES = ["USD", "EUR", "GBP", "SGD", "HKD", "CHF", "AED", "AUD", "CAD", "JPY"];

export function parsePairingFinishOptions(value: unknown): PairingFinishOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter((o): o is PairingFinishOption => !!o && typeof o.id === "string" && typeof o.name === "string" &&
    o.name.trim().length > 0 && (o.price_cents === null || Number.isSafeInteger(o.price_cents) && o.price_cents > 0));
}

export function pairingFinishError(options: PairingFinishOption[], pickId: string | null): string | null {
  if (options.length && !pickId) return "Choose a preferred piece before adding finishes.";
  if (options.length > 50) return "Use no more than 50 finish choices.";
  if (new Set(options.map((o) => o.id)).size !== options.length) return "Finish choices must have unique references.";
  if (new Set(options.map((o) => o.name.trim().toLowerCase())).size !== options.length) return "Give each finish choice a different name.";
  if (options.some((o) => !o.name.trim() || o.name.trim().length > 160)) return "Give each finish choice a name up to 160 characters.";
  if (options.some((o) => o.price_cents !== null && (!Number.isSafeInteger(o.price_cents) || o.price_cents <= 0 || o.price_cents > 1000000000))) return "Enter a positive retail price, or leave it blank for Price upon Request.";
  return null;
}

/** Resolve only a live rule's exact option for its bound piece; never fall back. */
export function resolvePairingFinish(rule: { id: string; enabled: boolean; preferred_pick_id: string | null; finish_options: unknown; finish_currency: string } | undefined, ref: PairingReference, pickId: string) {
  if (!rule || rule.id !== ref.ruleId || !rule.enabled || rule.preferred_pick_id !== pickId || !PAIRING_FINISH_CURRENCIES.includes(rule.finish_currency)) return null;
  const option = parsePairingFinishOptions(rule.finish_options).find((o) => o.id === ref.optionId);
  if (!option?.price_cents) return null;
  return { option, currency: rule.finish_currency };
}