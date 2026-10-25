import { describe, expect, it } from "vitest";
import { comparisonSectionPages } from "./comparisonPdfLayout";

describe("landscape comparison pagination", () => {
  it("keeps all standard sections on one sheet", () => {
    expect(comparisonSectionPages([9, 9, 30, 17, 9, 9, 11], 110, 160)).toEqual([[0, 1, 2, 3, 4, 5, 6]]);
  });
  it("moves a complete section rather than splitting products or values", () => {
    expect(comparisonSectionPages([10, 30, 35, 12], 50, 60)).toEqual([[0, 1], [2, 3]]);
  });
  it("rejects unsplittable sections that exceed a whole page", () => {
    expect(() => comparisonSectionPages([161], 100, 160)).toThrow("Comparison section exceeds printable area");
  });
});