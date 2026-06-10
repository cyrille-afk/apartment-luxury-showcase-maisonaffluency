/**
 * Regression: dimensions must render consistently across the public product
 * lightbox and the public product sheet.
 *
 * Two issues this guards against:
 *   1. PublicProductLightbox forgetting to hydrate `dimensions` from
 *      `designer_curator_picks`, leaving variant products (e.g. Tectra 2)
 *      with no dimensions row.
 *   2. PublicProductPage rendering the no-variant `dimensions` fallback in
 *      the wrong slot (e.g. Casque Bar Cabinet showed it AFTER materials).
 *      The fallback must always sit BEFORE the materials/finish row.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(path.resolve(__dirname, "../../..", rel), "utf8");

describe("dimensions render consistency", () => {
  it("PublicProductLightbox hydrates `dimensions` from the database", () => {
    const src = read("src/components/PublicProductLightbox.tsx");
    // Must request the column…
    expect(src).toMatch(/\.select\([^)]*\bdimensions\b/);
    // …and merge it into the product object exposed to the renderer.
    expect(src).toMatch(/dimensions:\s*propProduct\.dimensions\s*\?\?\s*variantPayload\.dimensions/);
  });

  it("PublicProductPage renders the no-variant dimensions fallback BEFORE the materials/finish row", () => {
    const src = read("src/pages/PublicProductPage.tsx");
    const fallbackMarker = "No-variant fallback: dimensions must always appear BEFORE the materials/finish row";
    const materialsMarker = "Material / finish dropdown(s)";
    const fallbackIdx = src.indexOf(fallbackMarker);
    const materialsIdx = src.indexOf(materialsMarker);
    expect(fallbackIdx).toBeGreaterThan(-1);
    expect(materialsIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeLessThan(materialsIdx);
    // Guard against the fallback being silently deleted.
    expect(src).toMatch(
      /!hasVariants && product\.dimensions && looksLikeDimension\(product\.dimensions\)/,
    );
  });

  it("both surfaces render dimensions with the same helper pair (metric + imperial)", () => {
    for (const rel of [
      "src/components/PublicProductLightbox.tsx",
      "src/pages/PublicProductPage.tsx",
    ]) {
      const src = read(rel);
      expect(src).toMatch(/formatDimensionsMultiline\(product\.dimensions\)/);
      expect(src).toMatch(/formatImperialDimensions\(product\.dimensions\)/);
    }
  });
});
