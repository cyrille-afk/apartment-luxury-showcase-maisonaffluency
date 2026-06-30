import { describe, it, expect } from "vitest";
import { pickMatchesCategoryFilter } from "@/lib/pickCategoryFilter";
import { normalizeCategory } from "@/lib/productTaxonomy";

/**
 * Regression: a "Limited Edition"-tagged Seating product (e.g. Robicara
 * RC Club Chair) must NOT appear under the Décor category just because
 * the "Limited Edition" tag normalizes towards Decorative Objects.
 *
 * Bug history: a tag-fallback in DesignersDirectory was overriding the
 * pick's resolvable primary category. Fixed in pickMatchesCategoryFilter
 * by only consulting tags when the pick has no resolvable category.
 */
describe("pickMatchesCategoryFilter — Limited Edition / Décor regression", () => {
  const rcClubChair = {
    category: "Seating",
    subcategory: "Armchairs",
    tags: ["Limited Edition"],
  };

  it("sanity: 'Limited Edition' tag normalizes to Décor", () => {
    expect(normalizeCategory("Limited Edition")).toBe("Décor");
  });

  it("does NOT include a Seating pick with 'Limited Edition' tag under Décor", () => {
    expect(pickMatchesCategoryFilter(rcClubChair, "Décor", null)).toBe(false);
  });

  it("does NOT leak under Décor / Decorative Objects subcategory either", () => {
    expect(
      pickMatchesCategoryFilter(rcClubChair, "Décor", "Decorative Objects"),
    ).toBe(false);
  });

  it("still includes the pick under its real category (Seating)", () => {
    expect(pickMatchesCategoryFilter(rcClubChair, "Seating", null)).toBe(true);
  });

  it("still includes the pick under its real subcategory (Armchairs)", () => {
    expect(pickMatchesCategoryFilter(rcClubChair, "Seating", "Armchairs")).toBe(true);
  });

  it("falls back to tags ONLY when the pick has no resolvable category", () => {
    const untaggedSculpture = {
      category: null,
      subcategory: null,
      tags: ["Sculpture"],
    };
    expect(pickMatchesCategoryFilter(untaggedSculpture, "Décor", null)).toBe(true);
  });

  it("does not match an unrelated category", () => {
    expect(pickMatchesCategoryFilter(rcClubChair, "Lighting", null)).toBe(false);
  });

  it("returns all picks when no filter is active", () => {
    expect(pickMatchesCategoryFilter(rcClubChair, null, null)).toBe(true);
  });
});
