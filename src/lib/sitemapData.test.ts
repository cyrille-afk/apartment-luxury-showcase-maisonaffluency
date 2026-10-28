import { describe, expect, it } from "vitest";
import { categorySitemapRoutes, readSitemapPages } from "../../scripts/sitemap-data.mjs";
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "./productTaxonomy";
import { categoryUrl } from "./categorySlugs";

describe("sitemap completeness", () => {
  it("uses exactly the public category route inventory without fabricated lastmod", () => {
    const expected = CATEGORY_ORDER.flatMap((cat) => [categoryUrl(cat, null), ...SUBCATEGORY_MAP[cat].map((sub) => categoryUrl(cat, sub))]);
    const routes = categorySitemapRoutes();
    expect(routes.map((row: { loc: string }) => row.loc)).toEqual(expected);
    expect(routes.every((row: object) => !("lastmod" in row))).toBe(true);
    expect(routes.map((row: { loc: string }) => row.loc)).toContain("/products-category/tables/coffee-tables");
  });
  it("reads beyond the first result page", async () => {
    const calls: number[] = [];
    const rows = await readSitemapPages(async (from: number) => {
      calls.push(from);
      return { data: from === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }], error: null };
    }, 2);
    expect(rows).toHaveLength(3);
    expect(calls).toEqual([0, 2]);
  });
  it("rejects a later failed page rather than publishing partial results", async () => {
    await expect(readSitemapPages(async (from: number) => from === 0
      ? { data: [{ id: 1 }], error: null }
      : { data: null, error: new Error("Query unavailable") }, 1)).rejects.toThrow("Query unavailable");
  });
});