import { describe, it, expect } from "vitest";
import {
  applyQuoteFilters,
  emptyQuoteFilters,
  isQuoteFilterActive,
  lastNDaysRange,
  quoteDayKey,
  quoteMatchesFilters,
  quoteStatusCounts,
  isRangePresetActive,
  yearToDateRange,
  type FilterableQuote,
} from "./quoteFilters";


const rows: FilterableQuote[] = [
  { status: "draft", created_at: "2026-10-01T12:00:00.000Z" },
  { status: "submitted", created_at: "2026-10-10T12:00:00.000Z" },
  { status: "submitted", created_at: "2026-10-20T12:00:00.000Z" },
  { status: "confirmed", created_at: "2026-10-22T12:00:00.000Z" },
];

describe("quoteFilters", () => {
  it("keeps only the selected status", () => {
    expect(applyQuoteFilters(rows, { ...emptyQuoteFilters, status: "submitted" })).toEqual([
      rows[1],
      rows[2],
    ]);
  });

  it("treats both ends of the date range as inclusive", () => {
    const picked = applyQuoteFilters(rows, {
      status: "all",
      from: "2026-10-10",
      to: "2026-10-20",
    });
    expect(picked.map((q) => q.created_at.slice(0, 10))).toEqual(["2026-10-10", "2026-10-20"]);
  });

  it("drops quotes outside the range and combines status with dates", () => {
    expect(
      applyQuoteFilters(rows, { status: "submitted", from: "2026-10-11", to: "" }).map(
        (q) => q.created_at.slice(0, 10),
      ),
    ).toEqual(["2026-10-20"]);
    expect(applyQuoteFilters(rows, { status: "confirmed", from: "2026-10-23", to: "" })).toEqual([]);
  });

  it("returns the untouched list when no filter is active", () => {
    expect(isQuoteFilterActive(emptyQuoteFilters)).toBe(false);
    expect(applyQuoteFilters(rows, emptyQuoteFilters)).toBe(rows);
    expect(isQuoteFilterActive({ ...emptyQuoteFilters, from: "2026-10-01" })).toBe(true);
  });

  it("ignores unreadable timestamps rather than showing them", () => {
    expect(quoteDayKey("not-a-date")).toBe("");
    expect(quoteMatchesFilters({ status: "draft", created_at: "not-a-date" }, { ...emptyQuoteFilters, from: "2026-10-01" })).toBe(false);
    // With no date bound the row is still reachable by status alone.
    expect(quoteMatchesFilters({ status: "draft", created_at: "not-a-date" }, emptyQuoteFilters)).toBe(true);
  });

  it("counts quotes per status for the filter pills", () => {
    expect(quoteStatusCounts(rows)).toEqual({ draft: 1, submitted: 2, confirmed: 1 });
  });

  it("builds inclusive quick ranges", () => {
    const today = new Date(2026, 9, 23);
    expect(lastNDaysRange(7, today)).toEqual({ status: "all", from: "2026-10-17", to: "2026-10-23" });
    expect(lastNDaysRange(30, today)).toEqual({ status: "all", from: "2026-09-24", to: "2026-10-23" });
    expect(yearToDateRange(today)).toEqual({ status: "all", from: "2026-01-01", to: "2026-10-23" });
  });

  it("highlights a quick range only when the dates match exactly", () => {
    const preset = { from: "2026-10-17", to: "2026-10-23" };
    expect(isRangePresetActive({ status: "all", ...preset }, preset)).toBe(true);
    expect(isRangePresetActive({ status: "all", ...preset, from: "2026-10-18" }, preset)).toBe(false);
    // A status picked alongside the range must not clear the highlight.
    expect(isRangePresetActive({ status: "draft", ...preset }, preset)).toBe(true);
  });
});
