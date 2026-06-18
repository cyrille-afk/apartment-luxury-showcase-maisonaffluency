/**
 * Per-line shipping aggregation
 * -----------------------------
 * Quotes can now carry products that ship from different origin countries
 * (e.g. one piece made in France, another in Germany). This module:
 *
 *  1. resolves each line's effective shipping inputs (origin, mode, CBM, kg)
 *     from the per-line override → product catalogue origin → fallback,
 *  2. groups lines by (origin, mode) — one physical shipment per group,
 *  3. runs the live estimator for each group with the summed packing and
 *     declared value (in EUR),
 *  4. returns a flat list of shipments plus aggregated EUR totals that
 *     the landed-cost panels and PDF can consume as an `overrideShipping`.
 *
 * Per-line CBM/kg are optional — when absent we fall back to a small
 * "per-product" default so newly-added lines don't break the estimator.
 */
import { estimateShipping, ShippingBreakdown, ShipmentMode } from "@/lib/shippingEstimator";

/** Origin string from the catalogue → ISO-2 country code. */
const ORIGIN_TO_ISO: Record<string, string> = {
  france: "FR", fr: "FR", paris: "FR",
  germany: "DE", de: "DE", deutschland: "DE",
  italy: "IT", it: "IT", italia: "IT",
  spain: "ES", es: "ES", españa: "ES", espana: "ES",
  portugal: "PT", pt: "PT",
  "united kingdom": "GB", uk: "GB", "great britain": "GB", england: "GB", britain: "GB", gb: "GB",
  belgium: "BE", be: "BE",
  netherlands: "NL", nl: "NL", holland: "NL",
  switzerland: "CH", ch: "CH",
  austria: "AT", at: "AT",
  denmark: "DK", dk: "DK",
  sweden: "SE", se: "SE",
  norway: "NO", no: "NO",
  finland: "FI", fi: "FI",
  ireland: "IE", ie: "IE",
  poland: "PL", pl: "PL",
  "czech republic": "CZ", czechia: "CZ", cz: "CZ",
  greece: "GR", gr: "GR",
  turkey: "TR", tr: "TR", türkiye: "TR", turkiye: "TR",
  morocco: "MA", ma: "MA",
  "united states": "US", usa: "US", us: "US", america: "US",
  canada: "CA", ca: "CA",
  japan: "JP", jp: "JP",
  china: "CN", cn: "CN",
  "hong kong": "HK", hk: "HK",
  india: "IN", in: "IN",
};

export const toIsoCountry = (raw: string | null | undefined, fallback = "FR"): string => {
  if (!raw) return fallback;
  const s = raw.trim();
  if (s.length === 2) return s.toUpperCase();
  const lower = s.toLowerCase();
  // Exact key match first (cheap path).
  if (ORIGIN_TO_ISO[lower]) return ORIGIN_TO_ISO[lower];
  // Free-form fallback: scan for any known country name inside the string
  // (e.g. "Handcrafted in Germany", "Made in Italy", "Hand-made — Portugal").
  // Match longest keys first so "united kingdom" wins over "uk".
  const keys = Object.keys(ORIGIN_TO_ISO).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length < 3) continue; // skip 2-letter ISO codes to avoid false hits
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) return ORIGIN_TO_ISO[k];
  }
  return fallback;
};

/** Conservative default packing per product line when nothing is entered. */
export const DEFAULT_LINE_CBM = 0.5;
const KG_PER_CBM: Record<ShipmentMode, number> = {
  sea_lcl: 350, sea_fcl: 750, air: 167, road: 333, courier: 200,
};

export interface RawLine {
  id: string;
  qty: number;
  /** Line subtotal in QUOTE currency (unit_trade × qty). */
  lineCents: number;
  productOrigin?: string | null;
  shipOriginCountry?: string | null;
  shipMode?: string | null;
  shipCbm?: number | null;
  shipWeightKg?: number | null;
}

export interface ResolvedLine extends RawLine {
  origin: string;     // ISO-2
  mode: ShipmentMode;
  cbm: number;
  kg: number;
  /** True when neither shipCbm nor shipWeightKg was provided on the line. */
  missingPacking: boolean;
}

export interface PerOriginShipment {
  origin: string;
  mode: ShipmentMode;
  lineIds: string[];
  totalCbm: number;
  totalKg: number;
  declaredEurCents: number;
  breakdown: ShippingBreakdown | null;
  shippingEurCents: number;
  dutyEurCents: number;
  vatEurCents: number;
  /** True when the estimator could not price this shipment. */
  unavailable: boolean;
  /** Human-readable reason when `unavailable` is true. */
  reason?: string;
}

export interface PerLineShippingResult {
  shipments: PerOriginShipment[];
  totalShippingEurCents: number;
  totalDutyEurCents: number;
  totalVatEurCents: number;
  totalDeclaredEurCents: number;
}

/** Pick a sensible default mode for a destination when the line doesn't set one. */
export const defaultModeFor = (destCountry: string): ShipmentMode => {
  const c = (destCountry || "").toUpperCase();
  // Long-haul → sea LCL by default; European-ish → road
  if (["HK", "SG", "JP", "CN", "AU", "NZ", "US", "CA", "AE"].includes(c)) return "sea_lcl";
  return "road";
};

const isMode = (s: unknown): s is ShipmentMode =>
  s === "sea_lcl" || s === "sea_fcl" || s === "air" || s === "road" || s === "courier";

export const resolveLine = (
  raw: RawLine,
  destCountry: string,
  fxQuoteToEur: number,
): ResolvedLine => {
  const origin = toIsoCountry(raw.shipOriginCountry ?? raw.productOrigin, "FR");
  const mode = isMode(raw.shipMode) ? raw.shipMode : defaultModeFor(destCountry);
  const cbm = Math.max(0.01, Number(raw.shipCbm ?? DEFAULT_LINE_CBM) * Math.max(1, raw.qty));
  const kg = raw.shipWeightKg != null && raw.shipWeightKg > 0
    ? Number(raw.shipWeightKg) * Math.max(1, raw.qty)
    : Math.round(cbm * KG_PER_CBM[mode]);
  return { ...raw, origin, mode, cbm, kg };
};

export async function computePerLineShipments(
  lines: RawLine[],
  destCountry: string,
  fxQuoteToEur: number,
  category: "furniture" | "lighting" | "art" | "textile" | "accessory" | "other" = "furniture",
): Promise<PerLineShippingResult> {
  const empty: PerLineShippingResult = {
    shipments: [], totalShippingEurCents: 0, totalDutyEurCents: 0,
    totalVatEurCents: 0, totalDeclaredEurCents: 0,
  };
  if (!lines.length || !destCountry || !fxQuoteToEur) return empty;

  const resolved = lines.map((l) => resolveLine(l, destCountry, fxQuoteToEur));
  // Group by (origin, mode)
  const buckets = new Map<string, ResolvedLine[]>();
  for (const l of resolved) {
    const k = `${l.origin}::${l.mode}`;
    const arr = buckets.get(k);
    if (arr) arr.push(l); else buckets.set(k, [l]);
  }

  const shipments: PerOriginShipment[] = [];
  for (const [key, group] of buckets) {
    const [origin, mode] = key.split("::") as [string, ShipmentMode];
    const totalCbm = group.reduce((s, l) => s + l.cbm, 0);
    const totalKg = group.reduce((s, l) => s + l.kg, 0);
    const declaredEurCents = Math.round(
      group.reduce((s, l) => s + l.lineCents, 0) * fxQuoteToEur
    );
    let breakdown: ShippingBreakdown | null = null;
    try {
      breakdown = await estimateShipping({
        origin_country: origin,
        dest_country: destCountry,
        total_volume_cbm: totalCbm,
        total_weight_kg: totalKg,
        declared_value_cents: declaredEurCents,
        currency: "EUR",
        preferred_mode: mode,
        category,
      });
    } catch {
      breakdown = null;
    }
    const shippingEurCents = breakdown?.available
      ? (breakdown.freight_cents + breakdown.fuel_cents + breakdown.insurance_cents
          + breakdown.customs_cents + breakdown.handling_cents + breakdown.last_mile_cents)
      : 0;
    shipments.push({
      origin, mode,
      lineIds: group.map((l) => l.id),
      totalCbm, totalKg, declaredEurCents,
      breakdown,
      shippingEurCents,
      dutyEurCents: breakdown?.duty_cents ?? 0,
      vatEurCents: breakdown?.vat_cents ?? 0,
    });
  }

  return {
    shipments,
    totalShippingEurCents: shipments.reduce((s, x) => s + x.shippingEurCents, 0),
    totalDutyEurCents: shipments.reduce((s, x) => s + x.dutyEurCents, 0),
    totalVatEurCents: shipments.reduce((s, x) => s + x.vatEurCents, 0),
    totalDeclaredEurCents: shipments.reduce((s, x) => s + x.declaredEurCents, 0),
  };
}
