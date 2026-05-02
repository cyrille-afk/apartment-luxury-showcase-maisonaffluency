/**
 * Regression: base-only products (e.g. Atelier Pendhapa "Mangala Coffee Table")
 * are functionally single-axis. Manual selection of a Base finish MUST always
 * resolve to its mapped gallery image — the resolver cannot mistake them for
 * dual-axis products and refuse the fallback.
 *
 * Fixture mirrors the real Mangala row: base-only selectable labels plus
 * legacy composite aliases that must NOT make the product behave as dual-axis.
 */
import { describe, it, expect } from "vitest";
import {
  buildProductFinishMap,
  resolveVariantImageIndex,
  resolveFinishImageIndex,
} from "@/lib/variantImageMap";

const MANGALA_VARIANT_IMAGE_MAP = {
  topbaseinredonyx: 8,
  "redonyx|redonyx": 8,
  topbaseinonyxhoney: 11,
  "onyxhoney|onyxhoney": 11,
  topinrakublanccrubaseinnaturalteak: 1,
  "naturalteak|rakublanccru": 1,
  topinlavastonecremebrulebaseinblackteak: 5,
  "blackteak|lavastonecremebrule": 5,
};

const IMAGE_COUNT = 14;

describe("Base-only product: manual Base pick always swaps the gallery image", () => {
  const finishMap = buildProductFinishMap(MANGALA_VARIANT_IMAGE_MAP);

  it("resolves Onyx Honey → image 11 even with legacy composite aliases present", () => {
    expect(
      resolveVariantImageIndex(finishMap, {
        base: "Top & Base in Onyx Honey",
        top: null,
        imageCount: IMAGE_COUNT,
        requireCompletePair: false,
      })
    ).toBe(11);
  });

  it("resolves Raku Blanc écru / Natural Teak → image 1", () => {
    expect(
      resolveVariantImageIndex(finishMap, {
        base: "Top in Raku Blanc écru & Base in Natural Teak",
        top: null,
        imageCount: IMAGE_COUNT,
        requireCompletePair: false,
      })
    ).toBe(1);
  });

  it("resolves Lava Stone Creme Brulée / Black Teak → image 5", () => {
    expect(
      resolveVariantImageIndex(finishMap, {
        base: "Top in Lava Stone Creme Brulée & Base in Black Teak",
        top: null,
        imageCount: IMAGE_COUNT,
        requireCompletePair: false,
      })
    ).toBe(5);
  });

  it("contains composite aliases, but base-only callers opt out of dual-axis short-circuiting", () => {
    const isDualAxisMap = Object.keys(finishMap || {}).some((k) => k.includes("|"));
    expect(isDualAxisMap).toBe(true);
    expect(
      resolveVariantImageIndex(finishMap, {
        base: "Top & Base in Red Onyx",
        top: null,
        imageCount: IMAGE_COUNT,
        requireCompletePair: false,
      })
    ).toBe(8);
  });

  it("returns undefined for unknown finish (instead of guessing)", () => {
    expect(
      resolveVariantImageIndex(finishMap, {
        base: "Carrara Marble",
        top: null,
        imageCount: IMAGE_COUNT,
      })
    ).toBeUndefined();
  });

  it("also resolves direct single-label lookups for legacy lightbox callers", () => {
    expect(resolveFinishImageIndex(finishMap, "Top & Base in Red Onyx", IMAGE_COUNT)).toBe(8);
    expect(resolveFinishImageIndex(finishMap, "Top & Base in Onyx Honey", IMAGE_COUNT)).toBe(11);
  });
});

/**
 * Mirrors the page-level handler in PublicProductPage / TradeProductPage
 * (`handleMaterialChange`) for the base-only branch. Encoding it here keeps
 * the contract tested even if the page handler is refactored — manual picks
 * must always produce a defined gallery index for known finishes.
 */
function pageGalleryIndexBaseOnly(opts: {
  base: string | null;
  imageCount: number;
}): number | undefined {
  const finishMap = buildProductFinishMap(MANGALA_VARIANT_IMAGE_MAP);
  // Base-only: requiresBaseAndTopSelection is false, so the partial-dual
  // guard never fires. Resolver runs straight through.
  return resolveVariantImageIndex(finishMap, {
    base: opts.base,
    top: null,
    imageCount: opts.imageCount,
    requireCompletePair: false,
  });
}

describe("Page handleMaterialChange (base-only branch): manual pick swaps image", () => {
  it.each([
    ["Top & Base in Red Onyx", 8],
    ["Top & Base in Onyx Honey", 11],
    ["Top in Raku Blanc écru & Base in Natural Teak", 1],
    ["Top in Lava Stone Creme Brulée & Base in Black Teak", 5],
  ])("manual pick %s → gallery index %i", (label, expected) => {
    expect(
      pageGalleryIndexBaseOnly({ base: label as string, imageCount: IMAGE_COUNT })
    ).toBe(expected);
  });
});
