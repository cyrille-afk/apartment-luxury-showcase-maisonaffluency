import { describe, expect, it } from "vitest";
import { resolveProductMenuCards, productMenuImageIndex } from "./productMenuImages";

describe("product menu catalogue slots", () => {
  it("keeps table images scoped to their named subcategories", () => {
    const links = ["Coffee Tables", "Dining Tables", "Side Tables", "Desks"].map((subcategory) => ({ label: subcategory, category: "Tables", subcategory }));
    const picks = links.flatMap((link) => [0, 1].map((i) => ({ ...link, image: `${link.label}-${i}` })));
    const cards = resolveProductMenuCards(links, picks);
    expect(cards.map((card) => card.images)).toEqual(links.map((link) => [`${link.label}-0`, `${link.label}-1`]));
  });
  it("rotates independently using each slot's image array", () => {
    expect(productMenuImageIndex(1, ["a", "b"])).toBe(1);
    expect(productMenuImageIndex(2, ["a", "b"])).toBe(0);
    expect(productMenuImageIndex(2, ["a", "b", "c"])).toBe(2);
  });
  it("leaves absent typologies empty instead of substituting other pieces", () => {
    expect(resolveProductMenuCards([{ label: "Bars", category: "Storage", subcategory: "Bars" }], [{ category: "Seating", subcategory: "Chairs", image: "chair" }])[0]?.images).toEqual([]);
  });
});