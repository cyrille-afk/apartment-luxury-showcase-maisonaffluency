import { describe, expect, it } from "vitest";
import { CIPRIANI_PACKAGE_OPTIONS, ciprianiResidencePreset } from "./proposalPresentation";
describe("Cipriani presentation selections", () => {
  it("offers exactly the supplied dollar package tiers", () => {
    expect(CIPRIANI_PACKAGE_OPTIONS).toEqual(["$250K", "$500K", "$1M"]);
  });
  it("uses Residence 04 only for the Cipriani project", () => {
    expect(ciprianiResidencePreset("Cipriani Miami")?.residenceName).toBe("Residence 04 · Levels 62–78");
    expect(ciprianiResidencePreset("Other project")).toBeNull();
  });
});