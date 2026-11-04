import { describe, expect, it } from "vitest";
import { PRODUCT_NAV, sortProductMenuLinks } from "./productNavigation";
import { resolveProductMenuCards } from "./productMenuImages";

describe("Rugs menu coverage", () => {
  it("starts with the complete Rugs collection rather than a restricted subcategory", () => {
    const menu = PRODUCT_NAV.find((item) => item.key === "rugs");
    expect(menu?.links[0]).toEqual({ label: "All Rugs", category: "Rugs" });
    const cards = resolveProductMenuCards(menu?.links.slice(0, 1) ?? [], [
      { category: "Rugs", subcategory: "Hand-Knotted Rugs", image: "knotted.jpg" },
      { category: "Rugs", subcategory: "Hand-Tufted Rugs", image: "tufted.jpg" },
    ]);
    expect(cards[0]?.images).toEqual(["knotted.jpg", "tufted.jpg"]);
  });
});

describe("Tables menu subcategories", () => {
  it("includes Bedside Tables and sorts the full menu alphabetically", () => {
    const menu = PRODUCT_NAV.find((item) => item.key === "tables");
    expect(menu).toBeDefined();
    const links = sortProductMenuLinks(menu?.links ?? []);
    expect(links.map((link) => link.label)).toEqual([
      "Bedside Tables", "Coffee Tables", "Consoles", "Desks", "Dining Tables", "Side Tables",
    ]);
    expect(links[0]).toEqual({ label: "Bedside Tables", category: "Bedroom", subcategory: "Bedside Tables" });
    const cards = resolveProductMenuCards(links, links.map((link) => ({ ...link, image: link.label })));
    expect(cards.map((card) => card.label)).toEqual(links.map((link) => link.label));
  });
  it("sorts newly added entries automatically without mutating menu data", () => {
    const links = ["Side Tables", "Bedside Tables", "Accent Tables"].map((label) => ({ label, category: "Tables" }));
    expect(sortProductMenuLinks(links).map((link) => link.label)).toEqual(["Accent Tables", "Bedside Tables", "Side Tables"]);
    expect(links.map((link) => link.label)).toEqual(["Side Tables", "Bedside Tables", "Accent Tables"]);
  });
});