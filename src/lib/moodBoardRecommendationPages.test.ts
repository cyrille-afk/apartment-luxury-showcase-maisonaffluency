import { describe, expect, it } from "vitest";
import { complementPage, nextComplementPage } from "./moodBoardRecommendationPages";

describe("complement pages", () => {
  it("shows six items and advances to six entirely new items", () => {
    const pool = Array.from({ length: 18 }, (_, id) => id);
    expect(complementPage(pool, 0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(complementPage(pool, nextComplementPage(0, pool.length))).toEqual([6, 7, 8, 9, 10, 11]);
  });
  it("exhausts every candidate before repeating, without padding the last page with repeats", () => {
    const pool = Array.from({ length: 14 }, (_, id) => id);
    expect(complementPage(pool, 2)).toEqual([12, 13]);
    expect(nextComplementPage(1, 14)).toBe(2);
    expect(nextComplementPage(2, 14)).toBe(0);
  });
  it("handles empty and single-page pools", () => {
    expect(nextComplementPage(0, 0)).toBe(0);
    expect(complementPage([], 0)).toEqual([]);
    expect(nextComplementPage(0, 6)).toBe(0);
  });
});