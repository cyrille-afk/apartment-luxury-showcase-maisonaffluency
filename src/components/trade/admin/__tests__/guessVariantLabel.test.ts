import { describe, it, expect } from "vitest";
import { guessVariantLabel } from "../GlbBulkUpload";
describe("guessVariantLabel", () => {
  it("reads W×D from filename", () => expect(guessVariantLabel("bob_95x77.obj")).toBe("W 95 × D 77"));
  it("reads W×D×H", () => expect(guessVariantLabel("ORS 120x40x200.glb")).toBe("W 120 × D 40 × H 200"));
  it("falls back to Default", () => expect(guessVariantLabel("gum.glb")).toBe("Default"));
});
