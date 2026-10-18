export interface PairingFinishOption { id: string; name: string; price_cents: number | null }
export interface PairingReference { ruleId: string; optionId: string }
interface StoredPairingRule { id: string; enabled: boolean; preferred_pick_id: string | null; finish_options: unknown; finish_currency: string }
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

/** Service-side publication checks prevent stale overrides buying unpublished pieces. */
export async function loadPairingRules(admin: any, refs: PairingReference[]): Promise<Map<string, StoredPairingRule>> {
  const ids = Array.from(new Set(refs.map((r) => r.ruleId).filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))));
  const result = new Map<string, StoredPairingRule>();
  if (!ids.length) return result;
  const { data: rules, error } = await admin.from("curated_pairing_rules").select("id, enabled, preferred_pick_id, finish_options, finish_currency").in("id", ids).eq("enabled", true);
  if (error) throw new Error("Pairing prices could not be verified.");
  const picks = Array.from(new Set((rules || []).map((r: StoredPairingRule) => r.preferred_pick_id).filter(Boolean)));
  if (!picks.length) return result;
  const { data: published, error: pickError } = await admin.from("designer_curator_picks_public").select("id, designer_id").in("id", picks);
  if (pickError) throw new Error("Pairing pieces could not be verified.");
  const designerIds = Array.from(new Set((published || []).map((p: any) => p.designer_id)));
  if (!designerIds.length) return result;
  const { data: designers, error: designerError } = await admin.from("designers").select("id").in("id", designerIds).eq("is_published", true).eq("trade_only", false);
  if (designerError) throw new Error("Pairing designers could not be verified.");
  const allowedDesigners = new Set((designers || []).map((d: any) => d.id));
  const allowedPicks = new Set((published || []).filter((p: any) => allowedDesigners.has(p.designer_id)).map((p: any) => p.id));
  for (const rule of rules || []) if (allowedPicks.has(rule.preferred_pick_id)) result.set(rule.id, rule);
  return result;
}