import { SHIPPING_COUNTRIES } from "@/lib/shippingDestination";

export function currencyForClientCountry(country?: string | null): string | null {
  const normalized = country?.trim().toLowerCase();
  if (!normalized) return null;
  return SHIPPING_COUNTRIES.find(
    (entry) => entry.iso.toLowerCase() === normalized || entry.name.toLowerCase() === normalized,
  )?.currency ?? null;
}

export function clientLocationDetails(client: {
  billing_country?: string | null;
  default_currency?: string | null;
}, ipCountry?: string | null) {
  const rawCountry = client.billing_country?.trim() || null;
  const country = SHIPPING_COUNTRIES.find(
    (entry) => entry.iso.toLowerCase() === rawCountry?.toLowerCase(),
  )?.name ?? rawCountry;
  const countryCurrency = currencyForClientCountry(country);
  return {
    country,
    countryCurrency,
    currency: client.default_currency?.trim() || countryCurrency,
    ipCountry: ipCountry?.trim() || null,
    ipCurrency: currencyForClientCountry(ipCountry),
  };
}