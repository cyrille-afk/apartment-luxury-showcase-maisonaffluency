import { describe, expect, it } from "vitest";
import { buildCategoryHead } from "./categoryHead";
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "./productTaxonomy";
import { categoryUrl } from "./categorySlugs";

describe("category search metadata", () => {
  it("gives every canonical category its own www URL and bounded metadata", () => {
    const titles = new Set<string>();
    for (const category of CATEGORY_ORDER) {
      for (const sub of [null, ...SUBCATEGORY_MAP[category]]) {
        const path = categoryUrl(category, sub);
        const parts = path.split("/");
        const { meta } = buildCategoryHead(parts[2], parts[3]);
        const title = meta.find((tag) => "title" in tag)?.title || "";
        const description = meta.find((tag) => tag.name === "description")?.content || "";
        expect(title.length).toBeLessThanOrEqual(60);
        expect(description.length).toBeGreaterThanOrEqual(50);
        expect(description.length).toBeLessThanOrEqual(160);
        expect(titles.has(title)).toBe(false);
        titles.add(title);
        expect(meta.find((tag) => tag.property === "og:url")?.content).toBe(`https://www.maisonaffluency.com${path}`);
      }
    }
  });
  it("does not index fabricated category slugs", () => {
    expect(buildCategoryHead("not-a-category").meta).toContainEqual({ name: "robots", content: "noindex, nofollow" });
  });
});