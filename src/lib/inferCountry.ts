/**
 * Best-effort browser country inference based on navigator locale.
 * Returns a country display name (e.g. "United Kingdom") or "" when unknown.
 *
 * Used to pre-select the most likely country in trade registration and
 * quote-request forms so UK / US / EU visitors don't have to scroll past
 * Singapore (the historical default).
 */
export const inferCountryFromBrowser = (): string => {
  if (typeof navigator === "undefined") return "";

  const locales = [...(navigator.languages || []), navigator.language].filter(Boolean);
  const displayNames =
    typeof Intl !== "undefined" && "DisplayNames" in Intl
      ? new Intl.DisplayNames(["en"], { type: "region" })
      : null;

  for (const locale of locales) {
    try {
      const region = new Intl.Locale(locale).region;
      if (region) {
        return displayNames?.of(region) || region;
      }
    } catch {
      const fallbackRegion = locale.match(/[-_]([a-z]{2})$/i)?.[1]?.toUpperCase();
      if (fallbackRegion) {
        return displayNames?.of(fallbackRegion) || fallbackRegion;
      }
    }
  }

  return "";
};

/**
 * Resolve the inferred country against an allow-list of supported countries.
 * Returns the matched entry from `supported` (preserving its casing), or
 * `fallback` when no match is found.
 */
export const inferSupportedCountry = (
  supported: readonly string[],
  fallback: string,
): string => {
  const inferred = inferCountryFromBrowser().trim().toLowerCase();
  if (!inferred) return fallback;

  // Common aliases the browser may emit that don't string-match our list verbatim.
  const aliases: Record<string, string> = {
    uk: "United Kingdom",
    "great britain": "United Kingdom",
    england: "United Kingdom",
    scotland: "United Kingdom",
    wales: "United Kingdom",
    "northern ireland": "United Kingdom",
    usa: "United States",
    "u.s.": "United States",
    "u.s.a.": "United States",
    america: "United States",
    uae: "United Arab Emirates",
  };

  const normalized = aliases[inferred] || inferred;
  const match = supported.find((c) => c.toLowerCase() === normalized.toLowerCase());
  return match || fallback;
};
