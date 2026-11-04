import { describe, expect, it } from "vitest";
import { resolveProductMenuCards, selectProductMenuImages, type ProductMenuRotationState } from "./productMenuImages";

describe("product menu catalogue slots", () => {
  it("keeps table images scoped to their named subcategories", () => {
    const links = ["Coffee Tables", "Dining Tables", "Side Tables", "Desks"].map((subcategory) => ({ label: subcategory, category: "Tables", subcategory }));
    const picks = links.flatMap((link) => [0, 1].map((i) => ({ ...link, image: `${link.label}-${i}` })));
    const cards = resolveProductMenuCards(links, picks);
    expect(cards.map((card) => card.images)).toEqual(links.map((link) => [`${link.label}-0`, `${link.label}-1`]));
  });
  it("includes every unique image from dozens of products, including Seating", () => {
    const links = [{ label: "Sofas", category: "Seating", subcategory: "Sofas" }];
    const picks = Array.from({ length: 45 }, (_, i) => ({ ...links[0], image: `sofa-${i}`, hoverImage: `sofa-${i}` }));
    const cards = resolveProductMenuCards(links, [...picks, { ...links[0], image: " " }]);
    expect(cards[0]?.images).toEqual(picks.map((pick) => pick.image));
    const state: ProductMenuRotationState = new Map();
    const selected = Array.from({ length: 45 }, (_, visit) => selectProductMenuImages(cards, visit, state, () => 0.37)[0]?.image);
    expect(new Set(selected).size).toBe(45);
    expect(new Set(selected)).toEqual(new Set(picks.map((pick) => pick.image)));
    expect(selected).not.toEqual(picks.map((pick) => pick.image));
  });
  it("does not immediately repeat after reshuffling or change on the same opening", () => {
    const cards = [{ label: "Chairs", category: "Seating", images: ["a", "b", "c"] }];
    const state: ProductMenuRotationState = new Map();
    const selected = Array.from({ length: 12 }, (_, visit) => {
      const first = selectProductMenuImages(cards, visit, state, () => 0.9);
      expect(selectProductMenuImages(cards, visit, state, () => 0)).toEqual(first);
      return first[0]?.image;
    });
    selected.slice(1).forEach((image, index) => expect(image).not.toBe(selected[index]));
  });
  it("avoids duplicate featured images across overlapping subcategory cards", () => {
    const cards = ["Bar Stools", "Ottomans & Stools"].map((label) => ({ label, category: "Seating", images: ["a", "b", "c"] }));
    const selected = selectProductMenuImages(cards, 1, new Map(), () => 0.9);
    expect(new Set(selected.map((card) => card.image)).size).toBe(2);
  });
  it("handles single images and empty pools without placeholder substitution", () => {
    const cards = [{ label: "Bars", category: "Storage", images: [] }, { label: "Bookcases", category: "Storage", images: ["bookcase"] }];
    const state: ProductMenuRotationState = new Map();
    for (let visit = 0; visit < 3; visit++) {
      expect(selectProductMenuImages(cards, visit, state).map((card) => card.image)).toEqual([undefined, "bookcase"]);
    }
  });
  it("rebuilds the shuffle bag when the catalogue expands", () => {
    const state: ProductMenuRotationState = new Map();
    const card = { label: "Chairs", category: "Seating", images: ["a"] };
    selectProductMenuImages([card], 1, state);
    const expanded = { ...card, images: ["a", "b", "c"] };
    const selected = [2, 3, 4].map((visit) => selectProductMenuImages([expanded], visit, state, () => 0.5)[0]?.image);
    expect(new Set(selected)).toEqual(new Set(expanded.images));
  });
  it("leaves absent typologies empty instead of substituting other pieces", () => {
    expect(resolveProductMenuCards([{ label: "Bars", category: "Storage", subcategory: "Bars" }], [{ category: "Seating", subcategory: "Chairs", image: "chair" }])[0]?.images).toEqual([]);
  });
});