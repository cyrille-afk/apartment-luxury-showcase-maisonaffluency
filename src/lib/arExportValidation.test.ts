import { describe, expect, it } from "vitest";
import { validateArExport, type ArValidationInput } from "./arExportValidation";

const gum: ArValidationInput = { dimensions: [.900506, .749894, .770469], expected: [.9, .75, .77], vertices: 7403, exportedUp: [0, 1, 0] };
describe("AR export validation", () => {
  it("accepts the corrected 90cm GUM export", () => expect(validateArExport(gum)).toEqual([]));
  it("accepts the corrected 170 × 95 × 41cm IBO export", () => {
    expect(validateArExport({ ...gum, dimensions: [1.69971, .41, .949867], expected: [1.7, .41, .95], vertices: 34511 })).toEqual([]);
  });
  it("flags the original 900-metre GUM scale", () => {
    expect(validateArExport({ ...gum, dimensions: [900, 750, 770] }).map(issue => issue.code)).toContain("unrealistic-dimensions");
  });
  it("flags the original 170-metre IBO scale", () => {
    expect(validateArExport({ ...gum, dimensions: [170, 41, 95] }).map(issue => issue.code)).toContain("unrealistic-dimensions");
  });
  it("flags tiny unit conversions", () => {
    expect(validateArExport({ ...gum, dimensions: [.0009, .00075, .00077] }).map(issue => issue.code)).toContain("unrealistic-dimensions");
  });
  it("flags swapped height and depth", () => {
    expect(validateArExport({ ...gum, dimensions: [1.7, .95, .41], expected: [1.7, .41, .95] }).map(issue => issue.code)).toContain("orientation-mismatch");
  });
  it.each([[0, 0, 1], [0, -1, 0]] as [number, number, number][])("flags sideways or inverted audited up %j", (x, y, z) => {
    expect(validateArExport({ ...gum, exportedUp: [x, y, z] }).map(issue => issue.code)).toContain("not-upright");
  });
  it("does not call missing evidence a pass", () => {
    expect(validateArExport({ dimensions: gum.dimensions, vertices: 7403 }).map(issue => issue.code)).toEqual(["dimensions-unconfirmed", "orientation-unconfirmed"]);
  });
  it("flags empty and non-finite geometry", () => {
    expect(validateArExport({ ...gum, vertices: 0 })[0]?.code).toBe("invalid-geometry");
    expect(validateArExport({ ...gum, dimensions: [NaN, 1, 1] })[0]?.code).toBe("invalid-geometry");
  });
});