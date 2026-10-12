import { describe, expect, it } from "vitest";
import { buildProductFinishMap, findVariantForImageIndex, resolveVariantImageIndex, variantImageKey } from "../variantImageMap";

const variants = [
  { label: "Scene 1", base: "100% Himalayan wool", dimensions: "230×230 cm" },
  { label: "Scene 2", base: "100% Himalayan wool", dimensions: "170×330 cm" },
  { label: "Scene 3", base: "100% Himalayan wool", dimensions: "230×300 cm" },
];
const raw = Object.fromEntries(variants.map((v, i) => [variantImageKey(v.base, null, v.label), i]));
const map = buildProductFinishMap(raw);

describe("Independent rug-size images", () => {
  it("assigns distinct keys to all three sizes sharing Himalayan wool", () => {
    expect(Object.keys(raw)).toEqual([
      "100himalayanwool|scene1", "100himalayanwool|scene2", "100himalayanwool|scene3",
    ]);
  });
  it("changing Scene 2 leaves Scene 1 and Scene 3 untouched", () => {
    const changed = buildProductFinishMap({ ...raw, [variantImageKey(variants[1].base, null, variants[1].label)]: 3 });
    expect(variants.map((v) => resolveVariantImageIndex(changed, { base: v.base, size: v.label, variants, imageCount: 4 }))).toEqual([0, 3, 2]);
  });
  it.each(variants.map((v, i) => [v.label, i] as const))("selecting %s resolves its own image", (label, index) => {
    expect(resolveVariantImageIndex(map, { base: variants[0].base, size: label, variants, imageCount: 3 })).toBe(index);
  });
  it.each(variants.map((v, i) => [v.label, i] as const))("image %s restores the right size", (label, index) => {
    expect(findVariantForImageIndex(map, variants, index)?.label).toBe(label);
  });
  it("retains legacy finish-only assignments until a size is assigned", () => {
    const legacy = buildProductFinishMap({ "100himalayanwool": 0, "100himalayanwool|scene2": 1 });
    expect(variants.map((v) => resolveVariantImageIndex(legacy, { base: v.base, size: v.label, variants, imageCount: 3 }))).toEqual([0, 1, 0]);
  });
  it("supports a Top-only finish with a size", () => {
    const key = variantImageKey(null, "Wool", "Large");
    expect(key).toBe("wool|large");
    expect(resolveVariantImageIndex(buildProductFinishMap({ [key]: 2 }), { top: "Wool", size: "Large", requireCompletePair: false, imageCount: 3 })).toBe(2);
  });
});