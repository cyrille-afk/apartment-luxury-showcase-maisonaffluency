/**
 * Pure filtering helpers for the trade Quotes & Proformas list.
 *
 * Kept out of the page component so the rules (status match, inclusive date
 * bounds, quick ranges) can be unit-tested without mounting anything.
 */

export interface QuoteFilterState {
  /** "all" or one of the trade_quotes status values. */
  status: string;
  /** Inclusive lower bound as "YYYY-MM-DD", or "" when unset. */
  from: string;
  /** Inclusive upper bound as "YYYY-MM-DD", or "" when unset. */
  to: string;
}

export const emptyQuoteFilters: QuoteFilterState = { status: "all", from: "", to: "" };

export type FilterableQuote = { status: string; created_at: string };

export const isQuoteFilterActive = (f: QuoteFilterState): boolean =>
  f.status !== "all" || f.from !== "" || f.to !== "";

/** "YYYY-MM-DD" in the studio's own timezone — the same day the card prints. */
export function formatLocalDay(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Calendar day a quote belongs to, or "" when the timestamp can't be read. */
export function quoteDayKey(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return formatLocalDay(date);
}

export function quoteMatchesFilters(quote: FilterableQuote, f: QuoteFilterState): boolean {
  if (f.status !== "all" && quote.status !== f.status) return false;
  const day = quoteDayKey(quote.created_at);
  if (!day) return false;
  if (f.from && day < f.from) return false;
  if (f.to && day > f.to) return false;
  return true;
}

export function applyQuoteFilters<T extends FilterableQuote>(
  quotes: T[],
  f: QuoteFilterState,
): T[] {
  if (!isQuoteFilterActive(f)) return quotes;
  return quotes.filter((q) => quoteMatchesFilters(q, f));
}

/** How many quotes sit in each status — used to label the status pills. */
export function quoteStatusCounts(quotes: FilterableQuote[]): Record<string, number> {
  const counts: Record<string, number> = {};
  quotes.forEach((q) => {
    counts[q.status] = (counts[q.status] || 0) + 1;
  });
  return counts;
}

/**
 * Inclusive quick range covering the last `days` calendar days, today included.
 * `days: 7` on 2026-10-23 therefore starts on 2026-10-17.
 */
export function lastNDaysRange(days: number, today: Date = new Date()): QuoteFilterState {
  const to = formatLocalDay(today);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - Math.max(0, days - 1));
  return { status: "all", from: formatLocalDay(start), to };
}

/** 1 January of `today`'s year through today. */
export function yearToDateRange(today: Date = new Date()): QuoteFilterState {
  return {
    status: "all",
    from: `${today.getFullYear()}-01-01`,
    to: formatLocalDay(today),
  };
}

/** True when the picked range is exactly the given preset (for pill highlighting). */
export function rangeMatchesPreset(
  f: QuoteFilterState,
  preset: { from: string; to: string },
): boolean {
  return f.status === "all" && f.from === preset.from && f.to === preset.to;
}
