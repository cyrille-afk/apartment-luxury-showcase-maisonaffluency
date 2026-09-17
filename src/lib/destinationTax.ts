/**
 * Destination-aware VAT / GST presets for quotes.
 *
 * Given the effective delivery country (ship-to country, falling back to the
 * client's billing country), returns the local consumption-tax label and rate
 * so quote tax lines calculate automatically instead of defaulting to 9% GST.
 *
 * Rates are indicative standard rates — the quote editor always allows a
 * manual override.
 */

export type DestinationTax = {
  iso: string;
  /** Tax line label, e.g. "VAT", "GST". */
  label: string;
  /** Standard rate in percent. 0 means no consumption tax applies. */
  rate: number;
};

/** ISO alpha-2 → standard consumption tax. */
const TAX_BY_ISO: Record<string, { label: string; rate: number }> = {
  // Europe
  GB: { label: "VAT", rate: 20 },
  FR: { label: "VAT", rate: 20 },
  DE: { label: "VAT", rate: 19 },
  IT: { label: "VAT", rate: 22 },
  ES: { label: "VAT", rate: 21 },
  NL: { label: "VAT", rate: 21 },
  BE: { label: "VAT", rate: 21 },
  IE: { label: "VAT", rate: 23 },
  PT: { label: "VAT", rate: 23 },
  AT: { label: "VAT", rate: 20 },
  LU: { label: "VAT", rate: 17 },
  MC: { label: "VAT", rate: 20 },
  GR: { label: "VAT", rate: 24 },
  DK: { label: "VAT", rate: 25 },
  SE: { label: "VAT", rate: 25 },
  NO: { label: "VAT", rate: 25 },
  FI: { label: "VAT", rate: 25.5 },
  PL: { label: "VAT", rate: 23 },
  CH: { label: "VAT", rate: 8.1 },
  LI: { label: "VAT", rate: 8.1 },
  // Middle East
  AE: { label: "VAT", rate: 5 },
  SA: { label: "VAT", rate: 15 },
  BH: { label: "VAT", rate: 10 },
  OM: { label: "VAT", rate: 5 },
  QA: { label: "VAT", rate: 0 },
  KW: { label: "VAT", rate: 0 },
  // Asia-Pacific
  SG: { label: "GST", rate: 9 },
  AU: { label: "GST", rate: 10 },
  NZ: { label: "GST", rate: 15 },
  JP: { label: "CT", rate: 10 },
  HK: { label: "GST", rate: 0 },
  MY: { label: "SST", rate: 10 },
  TH: { label: "VAT", rate: 7 },
  // Americas
  US: { label: "Sales tax", rate: 0 },
  CA: { label: "GST", rate: 5 },
  MX: { label: "VAT", rate: 16 },
};

/** Country names / variants → ISO alpha-2. */
const NAME_TO_ISO: Record<string, string> = {
  "uk": "GB", "u.k.": "GB", "gb": "GB", "united kingdom": "GB", "great britain": "GB",
  "england": "GB", "scotland": "GB", "wales": "GB", "northern ireland": "GB",
  "usa": "US", "u.s.": "US", "u.s.a.": "US", "united states": "US", "united states of america": "US",
  "uae": "AE", "united arab emirates": "AE", "dubai": "AE", "abu dhabi": "AE",
  "hong kong": "HK", "hong kong sar": "HK", "hong kong sar china": "HK", "hksar": "HK",
  "singapore": "SG", "france": "FR", "germany": "DE", "italy": "IT", "spain": "ES",
  "netherlands": "NL", "holland": "NL", "belgium": "BE", "ireland": "IE", "portugal": "PT",
  "austria": "AT", "luxembourg": "LU", "monaco": "MC", "greece": "GR", "denmark": "DK",
  "sweden": "SE", "norway": "NO", "finland": "FI", "poland": "PL", "switzerland": "CH",
  "liechtenstein": "LI", "saudi arabia": "SA", "bahrain": "BH", "oman": "OM", "qatar": "QA",
  "kuwait": "KW", "australia": "AU", "new zealand": "NZ", "japan": "JP", "malaysia": "MY",
  "thailand": "TH", "canada": "CA", "mexico": "MX",
};

/** Normalise a free-text country value to ISO alpha-2, or null when unknown. */
export const normalizeCountryIso = (value: string | null | undefined): string | null => {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return null;
  if (NAME_TO_ISO[raw]) return NAME_TO_ISO[raw];
  const upper = raw.toUpperCase();
  if (upper.length === 2 && TAX_BY_ISO[upper]) return upper;
  return upper.length === 2 ? upper : null;
};

/**
 * Resolve the tax preset for a delivery country.
 * Returns null when the country is unknown or has no preset.
 */
export const getDestinationTax = (country: string | null | undefined): DestinationTax | null => {
  const iso = normalizeCountryIso(country);
  if (!iso) return null;
  const entry = TAX_BY_ISO[iso];
  if (!entry) return null;
  return { iso, label: entry.label, rate: entry.rate };
};
