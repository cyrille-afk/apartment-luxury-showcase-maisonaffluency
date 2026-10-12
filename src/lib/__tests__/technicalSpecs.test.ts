import { describe, expect, it } from "vitest";
import { parseTechnicalSpecs } from "../technicalSpecs";
describe("technical specification disclosure", () => {
  it("keeps short rug specifications open", () => {
    expect(parseTechnicalSpecs("Materials: 100% Himalayan wool\n\nTechniques: Dhurrie").collapsible).toBe(false);
  });
  it("collapses long multi-line specifications", () => {
    expect(parseTechnicalSpecs("Technical Specs:\nMaterial: Wool\nTechnique: Dhurrie\nBacking: Cotton\nCare: Professional cleaning").collapsible).toBe(true);
  });
  it("collapses lengthy single-line text", () => {
    expect(parseTechnicalSpecs("Long specification. ".repeat(20)).collapsible).toBe(true);
  });
});
