/**
 * Server-side catalogue price verification for every checkout / order route.
 *
 * Callers submit line items with the catalogue `pickId` and the unit price the
 * buyer saw (already converted to the settlement currency). The claimed price
 * is accepted only when it matches a real catalogue price (base RRP or any
 * variant price) after server-side FX conversion, within a small tolerance for
 * rate drift between the browser and the server. Anything else is rejected —
 * a caller can never choose their own price.
 */
import { convertCents } from "./fxConvert.ts";
import { loadPairingRules, resolvePairingFinish, type PairingReference } from "./pairingFinishPricing.ts";

export interface ClaimedLine {
  pickId?: unknown;
  title?: unknown;
  designer?: unknown;
  finishLabel?: unknown;
  variant?: { base?: unknown; top?: unknown; size?: unknown } | null;
  unitCents?: unknown;
  quantity?: unknown;
  pairing?: PairingReference | null;
}

export interface VerifiedLine {
  pick_id: string;
  title: string;
  designer_name: string | null;
  finish_label: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export type VerifyResult =
  | { ok: true; lines: VerifiedLine[]; subtotalCents: number }
  | { ok: false; status: number; error: string; recovery?: CheckoutRecovery };

/** Structured hint so the browser can offer a safe retry without losing the configured line. */
export interface CheckoutRecovery {
  pickId: string;
  reason: "price_changed" | "finish_unavailable" | "unavailable";
  currentUnitCents?: number;
  pairing?: PairingReference | null;
}

/** Max accepted shortfall versus the converted catalogue price (FX drift). */
const TOLERANCE = 0.03;
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function verifyCatalogLines(
  admin: any,
  claimed: ClaimedLine[],
  currency: string,
  opts: { allowTradeOnly?: boolean; maxQty?: number } = {},
): Promise<VerifyResult> {
  if (!claimed.length) return { ok: false, status: 400, error: "At least one line item is required." };
  const maxQty = opts.maxQty ?? 999;
  const target = currency.toLowerCase();

  const pickIds = Array.from(new Set(claimed.map((l) => str(l.pickId, 64)).filter(Boolean)));
  if (pickIds.length !== new Set(claimed.map((l) => str(l.pickId, 64))).size || claimed.some((l) => !str(l.pickId, 64))) {
    return { ok: false, status: 400, error: "Every line must reference a catalogue piece." };
  }
  if (pickIds.some((id) => !/^[0-9a-zA-Z_-]{1,64}$/.test(id))) {
    return { ok: false, status: 400, error: "Invalid catalogue reference." };
  }

  const { data: products, error } = await admin
    .from("trade_products")
    .select("id, source_pick_id, rrp_price_cents, currency, public_rrp_visible, is_active")
    .or(pickIds.map((id) => `source_pick_id.eq.${id},id.eq.${id}`).join(","));
  if (error) {
    console.error("[catalogPricing] lookup failed", error);
    return { ok: false, status: 500, error: "Unable to verify prices right now." };
  }
  const sourceIds = Array.from(new Set((products || []).map((p: any) => p.source_pick_id).filter(Boolean)));
  const variantsByPick = new Map<string, any[]>();
  if (sourceIds.length) {
    const { data: picks } = await admin
      .from("designer_curator_picks")
      .select("id, size_variants")
      .in("id", sourceIds);
    for (const p of picks || []) variantsByPick.set(p.id, Array.isArray(p.size_variants) ? p.size_variants : []);
  }
  const byPick = new Map<string, any>();
  for (const row of products || []) {
    if (!row.is_active) continue;
    if (!row.public_rrp_visible && !opts.allowTradeOnly) continue;
    if (row.source_pick_id) byPick.set(row.source_pick_id, row);
    byPick.set(row.id, row);
  }

  const lines: VerifiedLine[] = [];
  const pairingRules = await loadPairingRules(admin, claimed.map((l) => l.pairing).filter((p): p is PairingReference => !!p));
  for (const l of claimed) {
    const pickId = str(l.pickId, 64);
    const title = str(l.title, 200) || "Collectible piece";
    const row = byPick.get(pickId);
    if (l.pairing) {
      const resolved = resolvePairingFinish(pairingRules.get(l.pairing.ruleId), l.pairing, pickId);
      if (!resolved || norm(l.finishLabel) !== norm(resolved.option.name)) return { ok: false, status: 409, error: `${title}'s pairing finish is no longer available. Please reselect it.`, recovery: { pickId, reason: "finish_unavailable", pairing: l.pairing } };
      const canonical = resolved.currency.toLowerCase() === target ? Number(resolved.option.price_cents) : await convertCents(Number(resolved.option.price_cents), resolved.currency.toLowerCase(), target);
      const claimedUnit = Math.round(Number(l.unitCents));
      if (!Number.isFinite(claimedUnit) || claimedUnit <= 0 || claimedUnit !== canonical) return { ok: false, status: 409, error: `The price for ${title} has changed. Please refresh your basket and try again.`, recovery: { pickId, reason: "price_changed", currentUnitCents: canonical, pairing: l.pairing } };
      const quantity = Math.min(maxQty, Math.max(1, Math.round(Number(l.quantity) || 1)));
      lines.push({ pick_id: pickId, title, designer_name: str(l.designer, 160) || null, finish_label: resolved.option.name, quantity, unit_price_cents: canonical, line_total_cents: canonical * quantity });
      continue;
    }
    if (!row) return { ok: false, status: 409, error: `${title} is not available for direct purchase — please send an enquiry.`, recovery: { pickId, reason: "unavailable" } };

    const src = String(row.currency || "usd").toLowerCase();
    const variants = variantsByPick.get(row.source_pick_id) || [];
    const base = Number(row.rrp_price_cents) || 0;

    // Narrow to the selected variant when it can be resolved.
    const sel = l.variant || {};
    const finish = norm(l.finishLabel);
    let matched = variants.filter((v) => {
      if (sel.base && norm(v?.base) !== norm(sel.base)) return false;
      if (sel.top && norm(v?.top) !== norm(sel.top)) return false;
      if (sel.size && norm(v?.label) !== norm(sel.size)) return false;
      return !!(sel.base || sel.top || sel.size);
    });
    if (!matched.length && finish) {
      matched = variants.filter((v) => {
        const toks = [v?.base, v?.top, v?.label].filter(Boolean).map(norm);
        return toks.length > 0 && toks.every((t) => finish.includes(t));
      });
    }
    const rawCandidates = (matched.length ? matched.map((v) => Number(v?.price_cents)) : [
      base,
      ...variants.map((v) => Number(v?.price_cents)),
    ]).filter((c) => Number.isFinite(c) && c > 0);
    if (!rawCandidates.length) {
      return { ok: false, status: 409, error: `${title} is price upon request — please send an enquiry.`, recovery: { pickId, reason: "unavailable" } };
    }
    const candidates = src === target
      ? rawCandidates
      : await Promise.all(rawCandidates.map((c) => convertCents(c, src, target)));

    const claimedUnit = Math.round(Number(l.unitCents));
    const ok = Number.isFinite(claimedUnit) && claimedUnit > 0 &&
      candidates.some((c) => claimedUnit >= c * (1 - TOLERANCE) && claimedUnit <= c * (1 + TOLERANCE));
    if (!ok) {
      console.warn("[catalogPricing] price mismatch", { pickId, claimedUnit, candidates, target });
      return {
        ok: false,
        status: 409,
        error: `The price for ${title} has changed. Please refresh your basket and try again.`,
        // Only offer a one-tap update when a single unambiguous price applies.
        recovery: { pickId, reason: "price_changed", ...(new Set(candidates).size === 1 ? { currentUnitCents: Math.round(candidates[0]) } : {}) },
      };
    }
    const quantity = Math.min(maxQty, Math.max(1, Math.round(Number(l.quantity) || 1)));
    lines.push({
      pick_id: pickId,
      title,
      designer_name: str(l.designer, 160) || null,
      finish_label: str(l.finishLabel, 250) || null,
      quantity,
      unit_price_cents: claimedUnit,
      line_total_cents: claimedUnit * quantity,
    });
  }
  return { ok: true, lines, subtotalCents: lines.reduce((n, l) => n + l.line_total_cents, 0) };
}
