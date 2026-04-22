import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  parseSingleAxisLabel,
  computeVariantAxes,
  type SizeVariant,
} from "../parseSizeVariants";

/**
 * Property-based tests: generate realistic catalogue-style variant labels and
 * assert invariants the UI relies on:
 *  - dropdown options are never empty strings
 *  - dropdown options are always deduped
 *  - parsed pairs (size × material) round-trip back to the source variant
 */

// --- Arbitraries that mimic real curator-pick labels --------------------------

const prefix = fc.constantFrom(
  "Angelo M/R 130",
  "Angelo M/R 160",
  "Angelo M/R 180",
  "Lady R low table",
  "Coffee table",
  "Side table",
  "Console",
  "Lamp",
  "Limited Edition"
);

const dimension = fc.oneof(
  fc.tuple(fc.integer({ min: 20, max: 300 })).map(([d]) => `Ø ${d} cm`),
  fc
    .tuple(fc.integer({ min: 20, max: 300 }), fc.integer({ min: 20, max: 300 }))
    .map(([w, h]) => `${w} × ${h} cm`),
  fc
    .tuple(
      fc.integer({ min: 20, max: 300 }),
      fc.integer({ min: 20, max: 300 }),
      fc.integer({ min: 20, max: 300 })
    )
    .map(([w, d, h]) => `Ø ${w} × H ${h} cm`),
  fc
    .tuple(fc.integer({ min: 50, max: 800 }), fc.integer({ min: 50, max: 800 }))
    .map(([w, h]) => `${w} × ${h} mm`)
);

const material = fc.constantFrom(
  "Kynos",
  "Travertine",
  "Marble",
  "Oak",
  "Walnut",
  "Brass",
  "Bronze",
  "Lacquer",
  "Linen"
);

// "Prefix: <dimension> <material>" — the dominant catalogue shape
const splitLabel = fc
  .tuple(prefix, dimension, material)
  .map(([p, d, m]) => `${p}: ${d} ${m}`);

// Clean dimension-only label (no material embedded)
const cleanLabel = dimension;

// Free-form label that wouldn't parse cleanly
const freeformLabel = fc.constantFrom(
  "Standard",
  "Large",
  "Custom Edition",
  "Unique piece",
  "Limited"
);

const anyLabel = fc.oneof(splitLabel, cleanLabel, freeformLabel);

const variantArb: fc.Arbitrary<SizeVariant> = fc.record({
  label: anyLabel,
  price_cents: fc.integer({ min: 0, max: 5_000_000 }),
});

const variantsArb = fc.array(variantArb, { minLength: 1, maxLength: 25 });

// --- Helpers ------------------------------------------------------------------

const allNonEmpty = (xs: string[]) => xs.every((x) => x.length > 0);
const isDeduped = (xs: string[]) => new Set(xs).size === xs.length;

// --- Properties ---------------------------------------------------------------

describe("parseSingleAxisLabel — properties", () => {
  it("never returns an empty size for a non-empty input", () => {
    fc.assert(
      fc.property(anyLabel, (label) => {
        const { size } = parseSingleAxisLabel(label);
        expect(size.length).toBeGreaterThan(0);
      })
    );
  });

  it("for split labels, both size and material are non-empty", () => {
    fc.assert(
      fc.property(splitLabel, (label) => {
        const { size, material } = parseSingleAxisLabel(label);
        expect(size.length).toBeGreaterThan(0);
        expect(material.length).toBeGreaterThan(0);
      })
    );
  });

  it("for split labels, the parsed material appears in the original label", () => {
    fc.assert(
      fc.property(splitLabel, (label) => {
        const { material } = parseSingleAxisLabel(label);
        expect(label.includes(material)).toBe(true);
      })
    );
  });

  it("is idempotent on its own size output (re-parsing a size yields the same size)", () => {
    fc.assert(
      fc.property(anyLabel, (label) => {
        const first = parseSingleAxisLabel(label);
        const second = parseSingleAxisLabel(first.size);
        expect(second.size).toBe(first.size);
      })
    );
  });
});

describe("computeVariantAxes — properties", () => {
  it("single-axis dropdown options are never empty and always deduped", () => {
    fc.assert(
      fc.property(variantsArb, (variants) => {
        const axes = computeVariantAxes(variants);
        if (axes.isDualAxis) return;
        expect(allNonEmpty(axes.singleSizeOptions)).toBe(true);
        expect(allNonEmpty(axes.singleMaterialOptions)).toBe(true);
        expect(isDeduped(axes.singleSizeOptions)).toBe(true);
        expect(isDeduped(axes.singleMaterialOptions)).toBe(true);
      })
    );
  });

  it("when split is detected, every parsed pair maps back to a real variant", () => {
    fc.assert(
      fc.property(fc.array(splitLabel, { minLength: 2, maxLength: 20 }), (labels) => {
        const variants: SizeVariant[] = labels.map((label) => ({ label, price_cents: 1 }));
        const axes = computeVariantAxes(variants);
        for (const p of axes.singleAxisParsed) {
          expect(variants).toContain(p.variant);
        }
      })
    );
  });

  it("dropdown options never exceed the number of source variants", () => {
    fc.assert(
      fc.property(variantsArb, (variants) => {
        const axes = computeVariantAxes(variants);
        expect(axes.singleSizeOptions.length).toBeLessThanOrEqual(variants.length);
        expect(axes.singleMaterialOptions.length).toBeLessThanOrEqual(variants.length);
      })
    );
  });

  it("a catalogue of pure split labels detects the split and dedupes sizes", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.tuple(prefix, dimension).map(([p, d]) => `${p}: ${d}`),
          { minLength: 2, maxLength: 5, selector: (s) => s }
        ),
        fc.uniqueArray(material, { minLength: 2, maxLength: 4 }),
        (sizePrefixes, materials) => {
          const variants: SizeVariant[] = [];
          for (const sp of sizePrefixes) {
            for (const m of materials) {
              variants.push({ label: `${sp} ${m}`, price_cents: 1 });
            }
          }
          const axes = computeVariantAxes(variants);
          expect(axes.hasSingleAxisSplit).toBe(true);
          // Sizes deduped to exactly the number of distinct size prefixes
          expect(axes.singleSizeOptions.length).toBe(sizePrefixes.length);
          // Materials deduped to exactly the input material count
          expect(axes.singleMaterialOptions.length).toBe(materials.length);
          expect(allNonEmpty(axes.singleSizeOptions)).toBe(true);
          expect(allNonEmpty(axes.singleMaterialOptions)).toBe(true);
        }
      )
    );
  });

  it("dual-axis options are never empty and always deduped", () => {
    const dualVariantArb = fc.record({
      label: fc.constantFrom("Small", "Medium", "Large"),
      base: material,
      top: material,
      price_cents: fc.integer({ min: 0, max: 100000 }),
    });
    fc.assert(
      fc.property(fc.array(dualVariantArb, { minLength: 1, maxLength: 20 }), (variants) => {
        const axes = computeVariantAxes(variants);
        expect(axes.isDualAxis).toBe(true);
        expect(allNonEmpty(axes.baseOptions)).toBe(true);
        expect(allNonEmpty(axes.topOptions)).toBe(true);
        expect(allNonEmpty(axes.dualSizeOptions)).toBe(true);
        expect(isDeduped(axes.baseOptions)).toBe(true);
        expect(isDeduped(axes.topOptions)).toBe(true);
        expect(isDeduped(axes.dualSizeOptions)).toBe(true);
      })
    );
  });
});
