/**
 * Regression guard for the Angelo M/R Dining Table bug:
 *
 * Dual-axis product (Size × Finish). When the user picks only the finish
 * (e.g. "Port Saint Laurent / Travertino Silver / Rosso Lepanto") without
 * a size — OR only the size without a finish — the price shown as the
 * "From €X" caption on the product page and the price recorded on the
 * quote line MUST be the same value: the cheapest priced variant matching
 * the partial selection.
 *
 * Previously the caption showed €16,829 (correct) but the quote line
 * fell back to €12,116 (base RRP / cheapest Kynos).
 */
import { describe, it, expect } from "vitest";
import {
  resolvePartialDualMinCents,
  resolveActiveVariantCents,
} from "@/lib/resolveActiveVariant";

const ANGELO_MR_VARIANTS = [
  { base: "Ø 130 × H 75 cm", top: "Kynos", price_cents: 1211600 },
  { base: "Ø 130 × H 75 cm", top: "Grafite", price_cents: 1301000 },
  { base: "Ø 130 × H 75 cm", top: "Travertino Rosso / Grey Saint Laurent / Picasso Green", price_cents: 1426300 },
  { base: "Ø 130 × H 75 cm", top: "Port Saint Laurent / Travertino Silver / Rosso Lepanto", price_cents: 1682900 },
  { base: "Ø 130 × H 75 cm", top: "Bianco Statuarietto", price_cents: 2099800 },
  { base: "Ø 160 × H 75 cm", top: "Kynos", price_cents: 1325100 },
  { base: "Ø 160 × H 75 cm", top: "Grafite", price_cents: 1424700 },
  { base: "Ø 160 × H 75 cm", top: "Port Saint Laurent / Travertino Silver / Rosso Lepanto", price_cents: 1870300 },
  { base: "Ø 180 × H 75 cm", top: "Kynos", price_cents: 1405900 },
  { base: "Ø 180 × H 75 cm", top: "Port Saint Laurent / Travertino Silver / Rosso Lepanto", price_cents: 2048400 },
];

const SILVER_TOP = "Port Saint Laurent / Travertino Silver / Rosso Lepanto";

describe("resolvePartialDualMinCents — quote line matches on-page caption", () => {
  it("returns null when nothing is picked", () => {
    expect(
      resolvePartialDualMinCents(
        { selectedBase: null, selectedTop: null, selectedDualSize: null },
        { sizeVariants: ANGELO_MR_VARIANTS, isDualAxis: true },
      ),
    ).toBeNull();
  });

  it("only finish picked → cheapest matching variant (Ø 130 Silver = €16,829)", () => {
    const cents = resolvePartialDualMinCents(
      { selectedBase: null, selectedTop: SILVER_TOP, selectedDualSize: null },
      { sizeVariants: ANGELO_MR_VARIANTS, isDualAxis: true },
    );
    expect(cents).toBe(1682900);
  });

  it("only size picked → cheapest matching variant (Ø 160 Kynos = €13,251)", () => {
    const cents = resolvePartialDualMinCents(
      { selectedBase: "Ø 160 × H 75 cm", selectedTop: null, selectedDualSize: null },
      { sizeVariants: ANGELO_MR_VARIANTS, isDualAxis: true },
    );
    expect(cents).toBe(1325100);
  });

  it("both axes picked → exact match (Ø 180 Silver = €20,484)", () => {
    const cents = resolvePartialDualMinCents(
      { selectedBase: "Ø 180 × H 75 cm", selectedTop: SILVER_TOP, selectedDualSize: null },
      { sizeVariants: ANGELO_MR_VARIANTS, isDualAxis: true },
    );
    expect(cents).toBe(2048400);
  });

  it("returns null for non-dual-axis products", () => {
    expect(
      resolvePartialDualMinCents(
        { selectedBase: "Any", selectedTop: null, selectedDualSize: null },
        { sizeVariants: ANGELO_MR_VARIANTS, isDualAxis: false },
      ),
    ).toBeNull();
  });

  it("returns null when the partial selection matches no priced variant", () => {
    expect(
      resolvePartialDualMinCents(
        { selectedBase: null, selectedTop: "Mithril", selectedDualSize: null },
        { sizeVariants: ANGELO_MR_VARIANTS, isDualAxis: true },
      ),
    ).toBeNull();
  });

  it("caption ↔ quote parity: single-axis pick uses SAME value in both flows", () => {
    // Simulates the on-page caption: no exact variant resolved (no size), so
    // it falls back to the partial-dual min.
    const captionCents = resolveActiveVariantCents(
      {
        selectedVariantIdx: null,
        selectedBase: null,
        selectedTop: SILVER_TOP,
        selectedDualSize: null,
        selectedSingleSize: null,
        selectedSingleMaterial: null,
      },
      {
        sizeVariants: ANGELO_MR_VARIANTS,
        isDualAxis: true,
        isBaseOnly: false,
        hasSingleAxisSplit: false,
        hasDualSize: true,
        baseOnlyRequiresSize: false,
      },
    ) ?? resolvePartialDualMinCents(
      { selectedBase: null, selectedTop: SILVER_TOP, selectedDualSize: null },
      { sizeVariants: ANGELO_MR_VARIANTS, isDualAxis: true },
    );

    // Simulates the quote flow after our fix: same fallback chain.
    const quoteCents = resolveActiveVariantCents(
      {
        selectedVariantIdx: null,
        selectedBase: null,
        selectedTop: SILVER_TOP,
        selectedDualSize: null,
        selectedSingleSize: null,
        selectedSingleMaterial: null,
      },
      {
        sizeVariants: ANGELO_MR_VARIANTS,
        isDualAxis: true,
        isBaseOnly: false,
        hasSingleAxisSplit: false,
        hasDualSize: true,
        baseOnlyRequiresSize: false,
      },
    ) ?? resolvePartialDualMinCents(
      { selectedBase: null, selectedTop: SILVER_TOP, selectedDualSize: null },
      { sizeVariants: ANGELO_MR_VARIANTS, isDualAxis: true },
    );

    expect(captionCents).toBe(1682900);
    expect(quoteCents).toBe(1682900);
    expect(captionCents).toBe(quoteCents);
    // Guard: must NOT be the base RRP Kynos €12,116 (the pre-fix regression).
    expect(quoteCents).not.toBe(1211600);
  });
});
