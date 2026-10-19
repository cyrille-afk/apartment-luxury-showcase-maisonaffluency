import { toIsoCountry, type PerLineShippingResult } from "@/lib/perLineShipping";
import { labelForMode } from "@/lib/shippingEstimator";
import { formatPdfMoney, type PdfLocalePreset } from "@/lib/pdfFormatting";

export function resolveQuoteFreightDestination(
  sameAsBilling: boolean, shipToCountry?: string | null, billingCountry?: string | null,
) {
  const usesShipTo = !sameAsBilling && Boolean(shipToCountry);
  const country = ((usesShipTo ? shipToCountry : billingCountry) || "").trim().toLowerCase();
  return { country, iso: toIsoCountry(country, ""), source: usesShipTo ? "Ship-to address" : "Billing address" };
}

export interface QuoteFreightAudit {
  destination: string;
  addressSource: string;
  shipments: Array<{ route: string; lines: string[] }>;
  total: string;
}

/** Uses estimator outputs verbatim; this presentation never reprices freight. */
export function buildQuoteFreightAudit(
  result: PerLineShippingResult, destination: string, addressSource: string,
  currency: string, fxQuoteToEur: number | null, locale?: PdfLocalePreset,
): QuoteFreightAudit {
  const native = (cents: number) => `${formatPdfMoney(cents, "EUR", locale)} EUR`;
  const quoted = (eur: number) => fxQuoteToEur && fxQuoteToEur > 0
    ? `${formatPdfMoney(Math.round(eur / fxQuoteToEur), currency, locale)} ${currency}`
    : "Awaiting exchange rate";
  let countryName = destination || "Not recorded";
  if (destination) {
    try { countryName = `${new Intl.DisplayNames(["en"], { type: "region" }).of(destination)} (${destination})`; } catch { /* Keep ISO */ }
  }
  return {
    destination: countryName, addressSource,
    shipments: result.shipments.map((shipment) => {
      const b = shipment.breakdown;
      const rate = b?.rate_calculation;
      const route = `${shipment.origin} to ${destination || "unknown destination"} - ${labelForMode(shipment.mode)}`;
      if (!b?.available) return { route, lines: [shipment.reason || b?.reason || "Freight estimate unavailable; manual quote required."] };
      const lines: string[] = [];
      if (rate) {
        lines.push(`Billable CBM: ${rate.billable_cbm.toFixed(3)} m³ | Chargeable weight: ${rate.chargeable_kg.toFixed(2)} kg`);
        lines.push(`Rate: base ${native(rate.base_rate_cents)} + ${native(rate.rate_per_cbm_cents)}/CBM + ${native(rate.rate_per_kg_cents)}/kg`);
        if (rate.min_charge_cents > 0) lines.push(`Minimum freight charge: ${native(rate.min_charge_cents)}`);
        if (rate.hub_uplift_percent > 0) lines.push(`Via ${b.proxy_origin} consolidation hub; inland transfer uplift: ${rate.hub_uplift_percent}% (indicative estimate)`);
      } else lines.push("Rate details unavailable for this estimate.");
      lines.push(`Calculated base freight: ${native(b.freight_cents)}`);
      const surcharges = shipment.shippingEurCents - b.freight_cents;
      if (surcharges !== 0) lines.push(`Fuel, insurance, handling and delivery charges: ${native(surcharges)}`);
      lines.push(`Calculated shipping amount: ${quoted(shipment.shippingEurCents)} (before import duty and VAT/GST)`);
      return { route, lines };
    }),
    total: quoted(result.totalShippingEurCents),
  };
}