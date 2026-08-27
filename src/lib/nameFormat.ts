/**
 * Abbreviate a person name to "F. LastName".
 * Handles compound names with "&" (e.g., "Guillaume Garnier & Florent Linker" → "G. Garnier & F. Linker").
 * Names that ARE the brand (no " - " separator) are returned in full.
 */

function abbreviateSingle(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function abbreviatePersonPart(person: string): string {
  if (person.includes(" & ")) {
    return person.split(" & ").map(n => abbreviateSingle(n.trim())).join(" & ");
  }
  return abbreviateSingle(person);
}

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Brand-first A–Z sorting.
 *
 * Every entry in the directory is treated as a cohesive brand, so it sorts on
 * the FIRST letter of its full public name, not on a last name:
 *   - "Andrea Claire Studio" → A
 *   - "Charles and Ray Eames" → C
 *   - "Hubert & Poyer" → H
 * A leading "The" is ignored for the bucket but kept in the displayed name:
 * "The Haas Brothers" → H. Other articles ("Le Berre Vevaud", "La Chance")
 * are part of the brand and stay under L.
 */

// Display name overrides: strip trailing person suffix for brands that should
// only show the atelier name.
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "rowin' atelier — rochette frederic & winkler hervé": "RoWin' Atelier",
  "rowin' atelier - rochette frederic & winkler hervé": "RoWin' Atelier",
  "made in kira - roman frankel": "Made in Kira",
};

export function displayDesignerName(name: string): string {
  const key = name.trim().toLowerCase();
  return DISPLAY_NAME_OVERRIDES[key] || name;
}

const LEADING_ARTICLES = /^the\s+/i;

/**
 * Sortable key for a designer/brand entry: the full public name, accent- and
 * article-stripped, lowercased. Comparing these with `localeCompare` yields a
 * strict alphabetical order by brand / first name.
 */
export function sortNameKey(name: string): string {
  const full = displayDesignerName((name || "").trim());
  if (!full) return "";
  // "Brand - Person" entries are branded by the part before the dash.
  const brandPart = full.includes(" - ") ? full.split(" - ")[0].trim() : full;
  let key = stripAccents(brandPart).toLowerCase();
  key = key.replace(LEADING_ARTICLES, "");
  // Drop leading punctuation/quotes so "'t Atelier" still buckets on the letter.
  key = key.replace(/^[^a-z0-9]+/, "").trim();
  return key || stripAccents(brandPart).toLowerCase();
}

/** First letter of the brand sort key, for A–Z grouping. */
export function lastNameInitial(name: string): string {
  const key = sortNameKey(name);
  const first = key.charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

/** Explicit alias — the directory groups by brand initial, not by last name. */
export const brandInitial = lastNameInitial;


/**
 * Format a designer display name for card headers.
 *
 * Rules:
 * - "Brand - First Last" → "Brand - F. Last" (person abbreviated)
 * - "First Last" (name = brand) → "First Last" (shown in full)
 *
 * @param name      The raw name string
 * @param displayName  Optional override (e.g. "Ecart Paris - Jean-Michel Frank")
 * @returns { brand: string | null; person: string } — brand is null when name = brand
 */
export function formatDesignerName(name: string, displayName?: string): { brand: string | null; person: string } {
  const full = displayName || name;

  if (full.includes(" - ")) {
    const [brand, ...rest] = full.split(" - ");
    const person = rest.join(" - ");
    return { brand: brand.trim(), person: abbreviatePersonPart(person) };
  }

  // Name IS the brand — show in full
  return { brand: null, person: full };
}
