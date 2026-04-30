/**
 * Regression: clearing one axis (Base or Top) on a dual-axis product must
 * NOT silently fall back to a single-axis key — otherwise the gallery
 * jumps to the wrong finish (e.g. "Sand-Blasted Ash Table Surface")
 * after the user clears their selection. The expected behaviour is that
 * partial selections snap the gallery back to the primary image (index 0)
 * via the page-level handler, and the resolver itself returns `undefined`
 * for any partial dual-axis lookup.
 *
 * Source of truth for the fixture: `designer_curator_picks` row for
 * "Segment Console Table" by Apparatus Studio.
 */
import { describe, it, expect } from "vitest";
import {
  buildProductFinishMap,
  resolveVariantImageIndex,
} from "@/lib/variantImageMap";

const SEGMENT_CONSOLE_VARIANT_IMAGE_MAP = {
  lacquer: 0,
  handcastresinlegs: 2,
  "handcastresinlegs|lacquer": 0,
  sandblastedashtablesurface: 2,
  "handcastresinlegs|sandblastedashtablesurface": 2,
};

const IMAGE_COUNT = 5;

describe("Dual-axis variant clear → never resolves to a stray finish", () => {
  const finishMap = buildProductFinishMap(SEGMENT_CONSOLE_VARIANT_IMAGE_MAP);

  it("resolves the full Base × Top pairing (sanity)", () => {
    const idx = resolveVariantImageIndex(finishMap, {
      base: "Hand-Cast Resin Legs",
      top: "Sand-Blasted Ash Table Surface",
      imageCount: IMAGE_COUNT,
    });
    expect(idx).toBe(2);
  });

  it("returns undefined when only Base is selected (Top cleared)", () => {
    // Previously this fell back to single-axis `handcastresinlegs` (= 2),
    // showing the Sand-Blasted Ash image even though Top was cleared.
    const idx = resolveVariantImageIndex(finishMap, {
      base: "Hand-Cast Resin Legs",
      top: null,
      imageCount: IMAGE_COUNT,
    });
    expect(idx).toBeUndefined();
  });

  it("returns undefined when only Top is selected (Base cleared)", () => {
    // Previously this fell back to single-axis `sandblastedashtablesurface`
    // (= 2), keeping the wrong finish on screen after a clear.
    const idx = resolveVariantImageIndex(finishMap, {
      base: null,
      top: "Sand-Blasted Ash Table Surface",
      imageCount: IMAGE_COUNT,
    });
    expect(idx).toBeUndefined();
  });

  it("returns undefined when both axes are cleared", () => {
    const idx = resolveVariantImageIndex(finishMap, {
      base: null,
      top: null,
      imageCount: IMAGE_COUNT,
    });
    expect(idx).toBeUndefined();
  });
});

/**
 * Mirrors the page-level guard in PublicProductPage / TradeProductPage
 * `handleMaterialChange`: any partial dual-axis selection must reset the
 * gallery to index 0. Encoding it here keeps the contract tested even if
 * the page handler is refactored.
 */
function pageGalleryIndex(opts: {
  base: string | null;
  top: string | null;
  size?: string | null;
  isDualAxisProduct: boolean;
  imageCount: number;
}): number | undefined {
  const isClear = !opts.base && !opts.top && !opts.size;
  if (isClear) return 0;
  if (opts.isDualAxisProduct && (!opts.base || !opts.top)) return 0;
  const finishMap = buildProductFinishMap(SEGMENT_CONSOLE_VARIANT_IMAGE_MAP);
  return resolveVariantImageIndex(finishMap, {
    base: opts.base,
    top: opts.top,
    size: opts.size,
    imageCount: opts.imageCount,
  });
}

describe("Page handleMaterialChange: clearing snaps gallery to image 0", () => {
  it("snaps to 0 when Top is cleared while Base remains", () => {
    expect(
      pageGalleryIndex({
        base: "Hand-Cast Resin Legs",
        top: null,
        isDualAxisProduct: true,
        imageCount: IMAGE_COUNT,
      })
    ).toBe(0);
  });

  it("snaps to 0 when Base is cleared while Top remains", () => {
    expect(
      pageGalleryIndex({
        base: null,
        top: "Sand-Blasted Ash Table Surface",
        isDualAxisProduct: true,
        imageCount: IMAGE_COUNT,
      })
    ).toBe(0);
  });

  it("snaps to 0 when both axes are cleared", () => {
    expect(
      pageGalleryIndex({
        base: null,
        top: null,
        isDualAxisProduct: true,
        imageCount: IMAGE_COUNT,
      })
    ).toBe(0);
  });

  it("still resolves the mapped image for a complete Base × Top pairing", () => {
    expect(
      pageGalleryIndex({
        base: "Hand-Cast Resin Legs",
        top: "Sand-Blasted Ash Table Surface",
        isDualAxisProduct: true,
        imageCount: IMAGE_COUNT,
      })
    ).toBe(2);
  });
});
