/**
 * Third-country (non-EU customs union) destination rules.
 *
 * Switzerland and Liechtenstein are NOT part of the EU customs union: a
 * shipment crossing that border is an export, cleared by Swiss customs, with
 * import VAT and any duties billed to the consignee by the courier.
 */

export type CustomsRegion = {
  /** ISO 3166-1 alpha-2 destination. */
  iso: string;
  /** Country name used in the checkout copy. */
  name: string;
  /** Freight/summary row label for this destination. */
  shippingLabel: string;
  /** Import-tax declaration shown in the customs disclosure. */
  notice: string;
};

const THIRD_COUNTRIES: Record<string, CustomsRegion> = {
  CH: {
    iso: "CH",
    name: "Switzerland",
    shippingLabel: "International Shipping (Switzerland)",
    notice:
      "Switzerland is outside the EU customs union. This order ships as a third-country export: Swiss import VAT (8.1%) and any applicable customs duties are assessed by Swiss customs on the declared value of the goods plus international freight, and billed by the courier at delivery. No EU VAT is charged at checkout.",
  },
  LI: {
    iso: "LI",
    name: "Liechtenstein",
    shippingLabel: "International Shipping (Liechtenstein)",
    notice:
      "Liechtenstein is outside the EU customs union. This order ships as a third-country export: import VAT (8.1%) and any applicable customs duties are assessed on entry on the declared value of the goods plus international freight, and billed by the courier at delivery. No EU VAT is charged at checkout.",
  },
};

/** True when the destination sits outside the EU customs union. */
export const isThirdCountryDestination = (iso?: string | null): boolean =>
  Boolean(iso && THIRD_COUNTRIES[iso.trim().toUpperCase()]);

/** Customs region for the destination, or null for EU/other handled regions. */
export const getCustomsRegion = (iso?: string | null): CustomsRegion | null =>
  (iso && THIRD_COUNTRIES[iso.trim().toUpperCase()]) || null;
