import { expect, it } from "vitest";
import { selectVisualMatches, visualMatchPercent } from "./visualSearchResults";

it("excludes matches below the selected displayed percentage, including the boundary", () => {
  const matches = [{ similarity: 0.734 }, { similarity: 0.735 }, { similarity: 0.8 }];
  expect(selectVisualMatches(matches, 74, 8)).toEqual([matches[2], matches[1]]);
});
it("limits results to the chosen count in descending similarity order", () => {
  expect(selectVisualMatches([{ similarity: 0.6 }, { similarity: 0.9 }, { similarity: 0.8 }], 0, 2)).toEqual([{ similarity: 0.9 }, { similarity: 0.8 }]);
});
it("returns no results when none meet the threshold", () => {
  expect(selectVisualMatches([{ similarity: 0.74 }], 90, 8)).toEqual([]);
});
it("bounds results to 24 and excludes invalid similarities", () => {
  expect(selectVisualMatches([...Array.from({ length: 30 }, () => ({ similarity: 0.7 })), { similarity: NaN }], 0, 100)).toHaveLength(24);
});
it("uses bounded cosine-similarity percentages, not invented confidence", () => {
  expect(visualMatchPercent(0.743)).toBe(74);
  expect(visualMatchPercent(1.1)).toBe(100);
  expect(visualMatchPercent(-0.2)).toBe(0);
});