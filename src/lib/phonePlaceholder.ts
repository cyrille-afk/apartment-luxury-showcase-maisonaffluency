/**
 * Country → international dial-code map for the supported trade countries.
 * Used to drive context-aware phone-number placeholders so a UK visitor
 * sees "+44 …" rather than the legacy "+65 XXXX XXXX".
 */
const DIAL_CODES: Record<string, string> = {
  Singapore: "+65",
  Australia: "+61",
  Canada: "+1",
  China: "+86",
  France: "+33",
  Germany: "+49",
  "Hong Kong": "+852",
  India: "+91",
  Indonesia: "+62",
  Italy: "+39",
  Japan: "+81",
  Malaysia: "+60",
  Netherlands: "+31",
  "New Zealand": "+64",
  Philippines: "+63",
  "South Korea": "+82",
  Spain: "+34",
  Switzerland: "+41",
  Taiwan: "+886",
  Thailand: "+66",
  "United Arab Emirates": "+971",
  "United Kingdom": "+44",
  "United States": "+1",
  Vietnam: "+84",
};

// Simple flag mapping for the regional selector.
const FLAG_BY_COUNTRY: Record<string, string> = {
  Singapore: "🇸🇬",
  Australia: "🇦🇺",
  Canada: "🇨🇦",
  China: "🇨🇳",
  France: "🇫🇷",
  Germany: "🇩🇪",
  "Hong Kong": "🇭🇰",
  India: "🇮🇳",
  Indonesia: "🇮🇩",
  Italy: "🇮🇹",
  Japan: "🇯🇵",
  Malaysia: "🇲🇾",
  Netherlands: "🇳🇱",
  "New Zealand": "🇳🇿",
  Philippines: "🇵🇭",
  "South Korea": "🇰🇷",
  Spain: "🇪🇸",
  Switzerland: "🇨🇭",
  Taiwan: "🇹🇼",
  Thailand: "🇹🇭",
  "United Arab Emirates": "🇦🇪",
  "United Kingdom": "🇬🇧",
  "United States": "🇺🇸",
  Vietnam: "🇻🇳",
};

export interface CountryDialOption {
  country: string;
  dial: string;
  flag: string;
}

/**
 * Sorted list of countries with their dial codes and flag emojis.
 * Used by the phone-input regional selector.
 */
export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = Object.entries(DIAL_CODES)
  .map(([country, dial]) => ({
    country,
    dial,
    flag: FLAG_BY_COUNTRY[country] ?? "",
  }))
  .sort((a, b) => a.country.localeCompare(b.country));

/**
 * Returns a phone-input placeholder appropriate for the given country.
 * Falls back to a neutral, multi-region hint when country is unknown.
 */
export const getPhonePlaceholder = (country?: string | null): string => {
  if (country && DIAL_CODES[country]) {
    return `${DIAL_CODES[country]} …`;
  }
  return "+65 …";
};

export const getDialCode = (country?: string | null): string | null =>
  (country && DIAL_CODES[country]) || null;

/**
 * ISO-3166 alpha-2 → country name, restricted to the supported dial list.
 * Used to resolve a geo/locale-detected country code into a dial prefix.
 */
const ISO_TO_COUNTRY: Record<string, string> = {
  SG: "Singapore",
  AU: "Australia",
  CA: "Canada",
  CN: "China",
  FR: "France",
  DE: "Germany",
  HK: "Hong Kong",
  IN: "India",
  ID: "Indonesia",
  IT: "Italy",
  JP: "Japan",
  MY: "Malaysia",
  NL: "Netherlands",
  NZ: "New Zealand",
  PH: "Philippines",
  KR: "South Korea",
  ES: "Spain",
  CH: "Switzerland",
  TW: "Taiwan",
  TH: "Thailand",
  AE: "United Arab Emirates",
  GB: "United Kingdom",
  US: "United States",
  VN: "Vietnam",
  // Nearby markets mapped onto their closest supported dial region.
  IE: "United Kingdom",
  BE: "Netherlands",
  AT: "Germany",
  PT: "Spain",
  MC: "France",
  LU: "France",
  GR: "Italy",
  SA: "United Arab Emirates",
  QA: "United Arab Emirates",
  KW: "United Arab Emirates",
  BH: "United Arab Emirates",
  OM: "United Arab Emirates",
  MX: "United States",
};

export const getDialCodeByIso = (iso?: string | null): string | null => {
  if (!iso) return null;
  const country = ISO_TO_COUNTRY[iso.trim().toUpperCase()];
  return country ? DIAL_CODES[country] ?? null : null;
};

/** Asia-Pacific ISO codes routed through the Singapore white-glove freight note. */
const APAC_CODES = new Set([
  "SG", "HK", "JP", "KR", "CN", "TW", "TH", "MY", "ID", "PH", "VN", "IN", "AU", "NZ",
]);
/** North American ISO codes routed through the New York distribution note. */
const NA_CODES = new Set(["US", "CA", "MX"]);

/**
 * Regional freight note for the bespoke specifications placeholder, keyed off
 * the geolocated session country. Defaults to the European craft network copy.
 */
export const getBespokeRegionNote = (iso?: string | null): string => {
  const code = iso?.trim().toUpperCase() ?? "";
  if (APAC_CODES.has(code)) {
    return "Note: Bespoke modifications will be evaluated by our Paris atelier for direct white-glove climate-controlled freight allocation to Singapore.";
  }
  if (NA_CODES.has(code)) {
    return "Note: Bespoke modifications will be evaluated by our Paris atelier for consolidated air freight schedules to our New York distribution point.";
  }
  return "Note: Bespoke modifications are custom-routed through our European craft network to optimize regional lead times.";
};

/**
 * Composes the localized bespoke textarea placeholder, weaving the active
 * finish name into the sentence when one is selected.
 */
export const buildBespokePlaceholder = (finishLabel?: string | null, iso?: string | null): string => {
  const finish = finishLabel?.trim();
  const finishClause = finish
    ? `alternative alterations to the selected ${finish} finish`
    : "alternative alterations to the selected finish";
  return `Specify custom leather textures, ${finishClause}, or custom dimensions. ${getBespokeRegionNote(iso)}`;
};
