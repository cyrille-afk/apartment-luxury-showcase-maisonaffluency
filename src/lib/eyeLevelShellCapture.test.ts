import { expect, it } from "vitest";
import { emptyShellObjects } from "./eyeLevelShellCapture";
it("projects an empty capture without removing saved furniture or finishes", () => {
  const pieces = [{ id: "console", finishes: ["brushed brass"] }];
  expect(emptyShellObjects(pieces, true)).toEqual([]);
  expect(pieces).toEqual([{ id: "console", finishes: ["brushed brass"] }]);
  expect(emptyShellObjects(pieces, false)).toBe(pieces);
});