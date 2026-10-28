import taxonomy from "../src/data/productTaxonomy.json" with { type: "json" };

export const sitemapSlug = (label) => label.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function categorySitemapRoutes() {
  return taxonomy.categories.flatMap((category) => {
    const loc = `/products-category/${sitemapSlug(category)}`;
    return [loc, ...(taxonomy.subcategories[category] || []).map((sub) => `${loc}/${sitemapSlug(sub)}`)]
      .map((loc) => ({ loc, changefreq: "weekly", priority: "0.7" }));
  });
}

/** A query failure must abort generation, never silently drop a content family. */
export async function readSitemapPages(queryPage, pageSize = 250) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryPage(from, from + pageSize - 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Sitemap query returned no confirmed rows");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}