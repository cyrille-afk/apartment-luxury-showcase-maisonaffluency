import { describe, expect, it } from "vitest";
import { productSeoText, seoDescription, seoTitle } from "./seoText";

describe("SEO text bounds", () => {
  it("keeps long product titles within 60 characters including the brand", () => {
    const result = productSeoText({ name: "Exceptionally long sculptural handcrafted coffee table", maker: "Maison Pouenat" });
    expect(result.title.length).toBeLessThanOrEqual(60);
    expect(result.title.endsWith(" — Maison Affluency")).toBe(true);
  });
  it("bounds both recorded descriptions and long fallback material lists at 160 characters", () => {
    expect(productSeoText({ name: "Opus", description: "Handcrafted furniture. ".repeat(30) }).description.length).toBeLessThanOrEqual(160);
    expect(productSeoText({ name: "Opus", materials: "Bronze and marble. ".repeat(30) }).description.length).toBeLessThanOrEqual(160);
  });
  it("replaces missing or short descriptions with at least 50 characters of context", () => {
    for (const description of [null, "", "Handcrafted."]) {
      const result = productSeoText({ name: "Opus Coffee Table", maker: "Michel Amar Studio", description });
      expect(result.description.length).toBeGreaterThanOrEqual(50);
      expect(result.description).toContain("Opus Coffee Table");
    }
    expect(seoDescription("", "Design").length).toBeGreaterThanOrEqual(50);
  });
  it("preserves concise titles and meaningful recorded copy", () => {
    expect(seoTitle("Jules Lamp")).toBe("Jules Lamp — Maison Affluency");
    const description = "An architectural table with a sculptural base, crafted in bronze and marble.";
    expect(seoDescription(description, "fallback")).toBe(description);
  });
});