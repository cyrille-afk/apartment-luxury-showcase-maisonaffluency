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

/**
 * Returns a phone-input placeholder appropriate for the given country.
 * Falls back to a neutral, multi-region hint when country is unknown.
 */
export const getPhonePlaceholder = (country?: string | null): string => {
  if (country && DIAL_CODES[country]) {
    return `${DIAL_CODES[country]} …`;
  }
  return "+44 / +1 / +65 …";
};

export const getDialCode = (country?: string | null): string | null =>
  (country && DIAL_CODES[country]) || null;
