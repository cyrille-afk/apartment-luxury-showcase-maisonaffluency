const EU_COUNTRIES = new Set([
  "FR", "IT", "ES", "DE", "PT", "BE", "NL", "DK", "SE", "AT", "IE", "GR", "FI", "LU", "MT",
  "CY", "SI", "SK", "CZ", "HU", "PL", "RO", "BG", "HR", "LT", "LV", "EE", "GB", "UK", "CH",
  "NO", "IS", "LI", "MC", "AD", "SM", "VA", "RS", "BA", "ME", "MK", "AL", "UA", "BY", "MD",
]);

const EUROPEAN_KEYWORDS = [
  "france",
  "french",
  "italy",
  "italian",
  "spain",
  "spanish",
  "germany",
  "german",
  "portugal",
  "portuguese",
  "belgium",
  "belgian",
  "netherlands",
  "dutch",
  "denmark",
  "danish",
  "sweden",
  "swedish",
  "switzerland",
  "swiss",
  "norway",
  "norwegian",
  "united kingdom",
  "england",
  "british",
  "ireland",
  "irish",
  "greece",
  "greek",
  "austria",
  "poland",
  "polish",
  "czech",
  "hungary",
  "romania",
  "bulgaria",
  "croatia",
  "slovenia",
  "slovakia",
  "lithuania",
  "latvia",
  "estonia",
  "finland",
  "luxembourg",
  "monaco",
  "europe",
  "european",
  "paris",
  "milan",
  "london",
];

export function isEuropeanOrigin(origin?: string | null, pickupCountry?: string | null): boolean {
  if (pickupCountry && EU_COUNTRIES.has(pickupCountry.trim().toUpperCase())) return true;
  if (!origin) return false;
  const normalized = origin.toLowerCase();
  return EUROPEAN_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function isHighTicketEuropeanFulfillment(
  unitCents: number,
  origin?: string | null,
  pickupCountry?: string | null,
  sourceCurrency?: string | null,
  thresholdCents = 500_000,
): boolean {
  if (unitCents < thresholdCents) return false;
  if (isEuropeanOrigin(origin, pickupCountry)) return true;
  if ((sourceCurrency || "").toUpperCase() === "EUR") return true;
  return false;
}
