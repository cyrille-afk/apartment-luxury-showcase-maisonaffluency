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

/**
 * Format a designer display name for card headers.
 *
 * Rules:
 * - "Brand - First Last" → "Brand - F. Last" (person abbreviated)
 * - "First Last" (name = brand) → "First Last" (shown in full)
 *
 * @param name      The raw name string
 * @param displayName  Optional override (e.g. "Ecart Paris - Jean-Michel Frank")
 * @returns { brand: string | null, person: string } — brand is null when name = brand
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
