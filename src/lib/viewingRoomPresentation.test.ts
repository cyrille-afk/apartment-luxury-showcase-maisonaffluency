import { describe, expect, it } from "vitest";
import { proposalImageFit, residenceArea } from "./viewingRoomPresentation";
describe("viewing room presentation data", () => {
  it("displays recorded square footage only", () => { expect(residenceArea("3 Bed · 2,400 sq ft")).toBe("2,400 sq ft"); expect(residenceArea("Sample layout · Residence 04 reference plan")).toBeNull(); });
  it("fits product photos without distortion", () => { expect(proposalImageFit(800, 1200, 100, 90)).toEqual({ width: 60, height: 90 }); expect(proposalImageFit(1600, 800, 100, 90)).toEqual({ width: 100, height: 50 }); });
});