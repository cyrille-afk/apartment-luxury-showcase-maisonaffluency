/**
 * Shipping Estimator — Phase 1 calculation engine
 * Pure TS, no AI. Reads from shipping_lanes / shipping_rate_brackets /
 * shipping_surcharges / shipping_duty_rates and returns a breakdown in cents.
 */

import { supabase } from "@/integrations/supabase/client";

export type ShipmentMode = "sea_lcl" | "sea_fcl" | "air" | "road" | "courier";

export interface EstimatorInput {
  origin_country: string;
  dest_country: string;
  total_volume_cbm: number;
  total_weight_kg: number;
  declared_value_cents: number;
  currency?: string;
  /** Optional: filter to a specific mode. If omitted, picks cheapest. */
  preferred_mode?: ShipmentMode;
  /** Furniture | lighting | art | textile — used for duty lookup. */
  category?: "furniture" | "lighting" | "art" | "textile" | "accessory" | "other";
}

export interface ShippingBreakdown {
  freight_cents: number;
  fuel_cents: number;
  insurance_cents: number;
  duty_cents: number;
  vat_cents: number;
  customs_cents: number;
  handling_cents: number;
  last_mile_cents: number;
  total_cents: number;
  currency: string;
  selected_lane_id: string | null;
  selected_carrier: string | null;
  selected_mode: ShipmentMode | null;
  transit_days_min: number | null;
  transit_days_max: number | null;
  available: boolean;
  reason?: string;
  detail: Array<{ label: string; value_cents: number; method: string }>;
}

const EMPTY_BREAKDOWN = (currency = "EUR", reason?: string): ShippingBreakdown => ({
  freight_cents: 0, fuel_cents: 0, insurance_cents: 0, duty_cents: 0, vat_cents: 0,
  customs_cents: 0, handling_cents: 0, last_mile_cents: 0, total_cents: 0, currency,
  selected_lane_id: null, selected_carrier: null, selected_mode: null,
  transit_days_min: null, transit_days_max: null,
  available: false, reason, detail: [],
});

/** Compute a shipping estimate from the live rate matrix. */
export async function estimateShipping(input: EstimatorInput): Promise<ShippingBreakdown> {
  const currency = input.currency || "EUR";
  const category = input.category || "furniture";

  if (!input.origin_country || !input.dest_country) {
    return EMPTY_BREAKDOWN(currency, "Origin and destination required");
  }

  // 1) Lanes matching origin/dest
  let lanesQuery = supabase
    .from("shipping_lanes")
    .select("*")
    .eq("origin_country", input.origin_country)
    .eq("dest_country", input.dest_country)
    .eq("active", true);
  if (input.preferred_mode) lanesQuery = lanesQuery.eq("mode", input.preferred_mode);

  const { data: lanes, error: lanesError } = await lanesQuery;
  if (lanesError) throw lanesError;
  if (!lanes || lanes.length === 0) {
    return EMPTY_BREAKDOWN(currency, "No lane configured — contact us for a manual quote.");
  }

  // 2) Brackets for those lanes (today within validity)
  const today = new Date().toISOString().slice(0, 10);
  const { data: brackets, error: brErr } = await supabase
    .from("shipping_rate_brackets")
    .select("*")
    .in("lane_id", lanes.map(l => l.id))
    .lte("valid_from", today);
  if (brErr) throw brErr;

  const cbm = Math.max(0.01, input.total_volume_cbm);
  const kg = Math.max(0, input.total_weight_kg);

  // For each lane, compute freight, pick cheapest
  let best: { lane: any; bracket: any; freight: number } | null = null;
  for (const lane of lanes) {
    const candidates = (brackets || []).filter(b =>
      b.lane_id === lane.id &&
      Number(b.min_volume_cbm) <= cbm && Number(b.max_volume_cbm) >= cbm &&
      Number(b.min_weight_kg) <= kg && Number(b.max_weight_kg) >= kg &&
      (!b.valid_to || b.valid_to >= today)
    );
    if (candidates.length === 0) continue;
    const b = candidates[0];
    const computed =
      Number(b.base_rate_cents) +
      Number(b.rate_per_cbm_cents) * cbm +
      Number(b.rate_per_kg_cents) * kg;
    const freight = Math.max(computed, Number(b.min_charge_cents));
    if (!best || freight < best.freight) best = { lane, bracket: b, freight };
  }

  if (!best) {
    return EMPTY_BREAKDOWN(currency, "No rate bracket matches this shipment volume — contact us.");
  }

  // 3) Surcharges
  const { data: surcharges } = await supabase
    .from("shipping_surcharges")
    .select("*")
    .eq("active", true);

  let fuel = 0, insurance = 0, customs = 0, handling = 0, lastMile = 0;
  const detail: ShippingBreakdown["detail"] = [
    { label: `Freight (${best.lane.carrier_name} · ${labelForMode(best.lane.mode)})`, value_cents: best.freight, method: "base" },
  ];

  for (const s of surcharges || []) {
    if (s.scope === "lane" && s.lane_id !== best.lane.id) continue;
    if (s.scope === "carrier" && s.carrier_name !== best.lane.carrier_name) continue;
    if (s.scope === "dest_zone" && s.dest_country !== input.dest_country) continue;

    let amount = 0;
    const v = Number(s.value_numeric);
    switch (s.calc_method) {
      case "percent":
        if (s.surcharge_type === "fuel") amount = best.freight * (v / 100);
        else if (s.surcharge_type === "insurance") amount = input.declared_value_cents * (v / 100);
        else amount = best.freight * (v / 100);
        break;
      case "flat": amount = v; break;
      case "per_cbm": amount = v * cbm; break;
      case "per_kg": amount = v * kg; break;
    }
    amount = Math.round(amount);
    detail.push({ label: prettyType(s.surcharge_type), value_cents: amount, method: s.calc_method });
    switch (s.surcharge_type) {
      case "fuel": fuel += amount; break;
      case "insurance": insurance += amount; break;
      case "customs": customs += amount; break;
      case "handling":
      case "documentation":
      case "security": handling += amount; break;
      case "last_mile": lastMile += amount; break;
    }
  }

  // 4) Duties + VAT
  const { data: duties } = await supabase
    .from("shipping_duty_rates")
    .select("*")
    .eq("dest_country", input.dest_country)
    .eq("category", category)
    .eq("active", true)
    .limit(1);

  let duty = 0, vat = 0;
  if (duties && duties.length > 0) {
    const d = duties[0];
    duty = Math.round(input.declared_value_cents * (Number(d.duty_percent) / 100));
    // VAT is typically applied on (value + duty + freight) in many jurisdictions
    const vatBase = input.declared_value_cents + duty + best.freight;
    vat = Math.round(vatBase * (Number(d.vat_percent) / 100));
    if (duty > 0) detail.push({ label: `Import duty (${d.duty_percent}%)`, value_cents: duty, method: "percent" });
    if (vat > 0) detail.push({ label: `Import VAT/GST (${d.vat_percent}%)`, value_cents: vat, method: "percent" });
  }

  const total = best.freight + fuel + insurance + customs + handling + lastMile + duty + vat;

  return {
    freight_cents: Math.round(best.freight),
    fuel_cents: fuel,
    insurance_cents: insurance,
    duty_cents: duty,
    vat_cents: vat,
    customs_cents: customs,
    handling_cents: handling,
    last_mile_cents: lastMile,
    total_cents: Math.round(total),
    currency,
    selected_lane_id: best.lane.id,
    selected_carrier: best.lane.carrier_name,
    selected_mode: best.lane.mode as ShipmentMode,
    transit_days_min: best.lane.transit_days_min,
    transit_days_max: best.lane.transit_days_max,
    available: true,
    detail,
  };
}

export function labelForMode(m: string): string {
  switch (m) {
    case "sea_lcl": return "Sea LCL";
    case "sea_fcl": return "Sea FCL";
    case "air": return "Air freight";
    case "road": return "Road";
    case "courier": return "Courier";
    default: return m;
  }
}

function prettyType(t: string): string {
  switch (t) {
    case "fuel": return "Fuel surcharge";
    case "insurance": return "Cargo insurance";
    case "customs": return "Customs clearance";
    case "handling": return "Handling";
    case "last_mile": return "Last-mile delivery";
    case "documentation": return "Documentation";
    case "security": return "Security surcharge";
    default: return t;
  }
}

export function formatMoney(cents: number, currency = "EUR"): string {
  const value = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}
