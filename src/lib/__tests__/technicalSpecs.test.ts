import { describe, expect, it } from "vitest";
import { parseTechnicalSpecs } from "../technicalSpecs";
describe("technical specification disclosure", () => {
  it("always shows the Fuga Description despite its length", () => {
    const text = "Fuga, a collection of woolen rugs which translates Cristián Mohaded mark-making by shifting, pulling and pushing boundaries, breaking traditional shapes and spaces, responding to the objects around it.";
    const result = parseTechnicalSpecs(`Description:\n${text}`);
    expect(result.collapsible).toBe(false);
    expect(result.bodyLines).toEqual([text]);
  });
  it("keeps even multi-paragraph descriptions open", () => {
    expect(parseTechnicalSpecs(`Description:\n${"A long paragraph. ".repeat(30)}\nSecond\nThird\nFourth`).collapsible).toBe(false);
  });
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
