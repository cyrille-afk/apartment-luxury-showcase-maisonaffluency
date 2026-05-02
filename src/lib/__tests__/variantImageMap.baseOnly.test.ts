/**
 * Regression: base-only products (e.g. Atelier Pendhapa "Mangala Coffee Table")
 * are functionally single-axis. Manual selection of a Base finish MUST always
 * resolve to its mapped gallery image — the resolver cannot mistake them for
 * dual-axis products and refuse the fallback.
 *
 * Fixture mirrors the shape stored in `designer_curator_picks.variant_image_map`
 * for a base-only product: every key is a normalized single-axis label, never
 * a `base|top` composite.
 */
import { describe, it, expect } from "vitest";
import {
  buildProductFinishMap,
  resolveVariantImageIndex,
  resolveFinishImageIndex,
} from "@/lib/variantImageMap";

const MANGALA_VARIANT_IMAGE_MAP = {
  // Normalized keys — see normFinish() in variantImageMap.ts
  solidteak: 0,
  burntoak: 1,
  blackenedash: 2,
};

const IMAGE_COUNT = 4;

describe("Base-only product: manual Base pick always swaps the gallery image", () => {
  const finishMap = buildProductFinishMap(MANGALA_VARIANT_IMAGE_MAP);

  it("resolves Solid Teak → image 0", () => {
    expect(
      resolveVariantImageIndex(finishMap, {
        base: "Solid Teak",
        top: null,
        imageCount: IMAGE_COUNT,
      })
    ).toBe(0);
  });

  it("resolves Burnt Oak → image 1", () => {
    expect(
      resolveVariantImageIndex(finishMap, {
        base: "Burnt Oak",
        top: null,
        imageCount: IMAGE_COUNT,
      })
    ).toBe(1);
  });

  it("resolves Blackened Ash → image 2", () => {
    expect(
      resolveVariantImageIndex(finishMap, {
        base: "Blackened Ash",
        top: null,
        imageCount: IMAGE_COUNT,
      })
    ).toBe(2);
  });

  it("does NOT short-circuit as dual-axis when only single-axis keys exist", () => {
    // The dual-axis short-circuit only applies when the map contains at least
    // one `base|top` composite key. A base-only map must always allow the
    // single-axis fallback even if `top` is null.
    const isDualAxisMap = Object.keys(finishMap || {}).some((k) => k.includes("|"));
    expect(isDualAxisMap).toBe(false);
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

  it("also resolves via resolveFinishImageIndex (lightbox path)", () => {
    // PublicProductLightbox uses resolveFinishImageIndex when the product is
    // single-axis. Manual finish pick must work through that path too.
    expect(resolveFinishImageIndex(finishMap, "Burnt Oak", IMAGE_COUNT)).toBe(1);
    expect(resolveFinishImageIndex(finishMap, "Blackened Ash", IMAGE_COUNT)).toBe(2);
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
  });
}

describe("Page handleMaterialChange (base-only branch): manual pick swaps image", () => {
  it.each([
    ["Solid Teak", 0],
    ["Burnt Oak", 1],
    ["Blackened Ash", 2],
  ])("manual pick %s → gallery index %i", (label, expected) => {
    expect(
      pageGalleryIndexBaseOnly({ base: label as string, imageCount: IMAGE_COUNT })
    ).toBe(expected);
  });
});
