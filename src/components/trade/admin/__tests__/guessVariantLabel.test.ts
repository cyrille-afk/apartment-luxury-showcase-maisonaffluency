import { describe, it, expect } from "vitest";
import { guessVariantLabel } from "../GlbBulkUpload";
describe("guessVariantLabel", () => {
  it("reads W×D from filename", () => expect(guessVariantLabel("bob_95x77.obj")).toBe("W 95 × D 77"));
  it("reads W×D×H", () => expect(guessVariantLabel("ORS 120x40x200.glb")).toBe("W 120 × D 40 × H 200"));
  it("falls back to Default", () => expect(guessVariantLabel("gum.glb")).toBe("Default"));
  it("reads millimetre diameter from ROUND filenames", () => expect(guessVariantLabel("CTS_1080_ROUND.glb")).toBe("W 108 × D 108"));
  it("reads millimetre length from OVAL filenames", () => expect(guessVariantLabel("CTS_1680_OVAL.glb")).toBe("W 168"));
  it("reads millimetre size from SQUARE filenames", () => expect(guessVariantLabel("side_450_square.glb")).toBe("W 45 × D 45"));
});
