import { describe, expect, it } from "vitest";
import { nextProductMenuImages } from "./productMenuPreload";
import { selectProductMenuImages, type ProductMenuRotationState } from "./productMenuImages";

describe("menu warm-up rotation", () => {
  it("previews the exact next asset without consuming the live shuffle bag", () => {
    const cards = [{ label: "Sofas", category: "Seating", images: ["a", "b", "c", "d"] }];
    const state: ProductMenuRotationState = new Map();
    selectProductMenuImages(cards, 0, state, () => 0.5);
    const before = JSON.stringify([...state]);
    const preview = nextProductMenuImages(cards, 1, state);
    expect(JSON.stringify([...state])).toBe(before);
    expect(selectProductMenuImages(cards, 1, state)).toEqual(preview);
    expect(new Set([0, 1, 2, 3].map((visit) => selectProductMenuImages(cards, visit, new Map(state), () => 0.5)[0]?.image)).size).toBeGreaterThan(1);
  });
});