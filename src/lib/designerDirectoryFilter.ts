import { brandInitial } from "@/lib/nameFormat";

const fold = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Search takes precedence; letter selection is a separate, catalogue-wide filter. */
export function filterDesignerDirectory<T extends { name: string; slug: string }>(
  designers: T[], query: string, letter: string | null,
): T[] {
  const search = fold(query.trim());
  return designers.filter((designer) => search
    ? fold(designer.name).includes(search) || fold(designer.slug).includes(search)
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