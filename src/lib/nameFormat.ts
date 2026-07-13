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
 * Return a sortable key for a designer/maker name based on the last name
 * (or, for brand-only names, the last significant word).
 *
 * Examples:
 * - "Pierre Bonnefille" → "bonnefille"
 * - "Andrée Putman" → "putman"
 * - "Made in Kira - Roman Frankel" → "frankel"
 */
// Explicit overrides for studio/brand names where the default "last word"
// heuristic gives the wrong A–Z bucket. Key = lowercased full name.
const SORT_KEY_OVERRIDES: Record<string, string> = {
  "apparatus studio": "apparatus",
  "lost profile studio": "lost",
};

export function sortNameKey(name: string): string {
  const full = name.trim();
  if (!full) return "";
  const overrideKey = full.toLowerCase();
  if (SORT_KEY_OVERRIDES[overrideKey]) return SORT_KEY_OVERRIDES[overrideKey];
  // For "Brand - Person" entries, sort by the person part.
  const personPart = full.includes(" - ")
    ? full.split(" - ").pop()?.trim() || full
    : full;
  const words = personPart.split(/\s+/);
  // Use the last alphabetic word (ignore trailing numerics like "1861"
  // and the generic suffix "Studio"/"Studios").
  let idx = words.length - 1;
  while (
    idx > 0 &&
    (/^\d+$/.test(words[idx]) || /^studios?$/i.test(words[idx]))
  ) {
    idx--;
  }
  const lastWord = words[idx] || "";
  const key = stripAccents(lastWord).toLowerCase().replace(/^[^a-z]+/, "");
  return key || sortNameKey(words.slice(0, idx).join(" "));
}

/** First-letter of the last-name sort key, for A–Z grouping. */
export function lastNameInitial(name: string): string {
  const key = sortNameKey(name);
  const first = key.charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

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
