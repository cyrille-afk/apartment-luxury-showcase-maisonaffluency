/**
 * Shared search rules for the admin inquiry inbox.
 *
 * The inbox applies every term as a server-side `or` group (groups are ANDed by
 * PostgREST), so a match older than the newest fetched page is still findable.
 * The same predicate is applied client-side as a final guard, which keeps the
 * list and the highlight/count logic honest even if a filter is skipped.
 */

export const INQUIRY_SEARCH_FIELDS = [
  "name",
  "email",
  "company",
  "subject",
  "message",
  "product_name",
  "designer_name",
  "admin_notes",
] as const;

export type SearchableInquiry = Record<string, unknown>;

/** Terms the shopper/admin typed, lowercased; capped so a paste can't build a huge query. */
export function inquirySearchTerms(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
}

function escapeIlikePattern(term: string): string {
  // Backslash-escape ILIKE wildcards and drop quotes that would break the
  // PostgREST `or` expression syntax.
  return term.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/"/g, "");
}

/** One `or` group: the term may appear in any searched column. */
export function inquirySearchOrGroup(term: string): string {
  const pattern = escapeIlikePattern(term);
  return INQUIRY_SEARCH_FIELDS.map((f) => `${f}.ilike."%${pattern}%"`).join(",");
}

/** Groups to apply, one per typed term. */
export function inquirySearchWhere(query: string): string[] {
  return inquirySearchTerms(query).map(inquirySearchOrGroup);
}

/** True when every typed term appears somewhere in the row. */
export function matchesInquirySearch(row: SearchableInquiry, query: string): boolean {
  const terms = inquirySearchTerms(query);
  if (terms.length === 0) return true;
  const haystack = INQUIRY_SEARCH_FIELDS.map((f) => String(row[f] ?? ""))
    .join("\u0001")
    .toLowerCase();
  return terms.every((t) => haystack.includes(t));
}
