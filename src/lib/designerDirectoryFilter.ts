import { brandInitial, displayDesignerName, sortNameKey } from "@/lib/nameFormat";

const fold = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** A single character always uses the same brand initial as the A–Z ribbon. */
export function directorySearchInitial(query: string): string | null {
  const initial = fold(query.trim()).charAt(0).toUpperCase();
  return /^[A-Z]$/.test(initial) ? initial : null;
}

function matchesNamePrefix(name: string, search: string): boolean {
  if (search.length === 1) return brandInitial(name) === search.toUpperCase();
  const displayed = fold(displayDesignerName(name).trim());
  if (displayed.startsWith(search) || sortNameKey(name).startsWith(search)) return true;
  // Collaborators and credited people retain first/last-name prefixes, not
  // arbitrary substrings or slug aliases. Ignore a trailing studio label.
  return displayed.split(/\s+(?:&|and|[-–—])\s+/).some(part => {
    const person = part.replace(/\s+(?:studio|atelier)$/i, "");
    const lastName = person.split(/\s+/).at(-1) ?? "";
    return person.startsWith(search) || lastName.startsWith(search);
  });
}

/** Search takes precedence; letter selection is a separate, catalogue-wide filter. */
export function filterDesignerDirectory<T extends { name: string; slug: string }>(
  designers: T[], query: string, letter: string | null,
): T[] {
  const search = fold(query.trim());
  return designers.filter((designer) => search
    ? matchesNamePrefix(designer.name, search)
    : !letter || brandInitial(designer.name) === letter.toUpperCase());
}

/** Only catalogue-derived labels leave the browser; arbitrary input never does. */
export function directorySearchDetails(designers: { name: string; slug: string }[], query: string) {
  const normalized = fold(query.trim());
  const matches = filterDesignerDirectory(designers, query, null);
  const exact = normalized ? matches.find(d => fold(d.name) === normalized || fold(d.slug) === normalized) : undefined;
  return {
    match_kind: !normalized ? 'empty' : exact ? 'exact_designer' : matches.length ? 'partial_designer' : 'unmatched',
    canonical_designer: exact?.slug ?? 'none',
    matched_designers: normalized ? matches.slice(0, 10).map(d => d.slug) : [],
    result_count: matches.length,
  };
}

export function directoryRefinement(previous: string, next: string) {
  const before = fold(previous.trim());
  const after = fold(next.trim());
  if (before === after) return null;
  if (!after) return 'clear';
  if (!before) return 'initial';
  if (after.startsWith(before)) return 'extend';
  if (before.startsWith(after)) return 'shorten';
  return 'replace';
}