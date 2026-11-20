import { describe, expect, it } from "vitest";
import { proposalImageFit, residenceArea, residenceDisplaySpecs } from "./viewingRoomPresentation";
describe("viewing room presentation data", () => {
  it("displays recorded square footage only", () => { expect(residenceArea("3 Bed · 2,400 sq ft")).toBe("2,400 sq ft"); expect(residenceArea("Sample layout · Residence 04 reference plan")).toBeNull(); });
  it("fits product photos without distortion", () => { expect(proposalImageFit(800, 1200, 100, 90)).toEqual({ width: 60, height: 90 }); expect(proposalImageFit(1600, 800, 100, 90)).toEqual({ width: 100, height: 50 }); });
  it("uses the two-bedroom sample when area is missing", () => expect(residenceDisplaySpecs("2-Bedroom Residence", null)).toBe("2 Bed · 1,850 sq ft"));
  it("uses the three-bedroom sample when area is missing", () => expect(residenceDisplaySpecs("3-Bedroom Bayfront", "Sample layout")).toBe("3 Bed · 2,640 sq ft"));
  it("uses the penthouse sample when area is missing", () => expect(residenceDisplaySpecs("Canaletto Penthouse", "")).toBe("Penthouse · 4,200 sq ft"));
  it("preserves recorded area", () => expect(residenceDisplaySpecs("Canaletto Penthouse", "Penthouse · 5,000 sq ft")).toBe("Penthouse · 5,000 sq ft"));
});