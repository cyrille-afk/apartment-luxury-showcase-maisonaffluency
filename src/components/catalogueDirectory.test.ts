import { describe, expect, it } from "vitest";
import taxonomy from "@/data/productTaxonomy.json";
import { CATALOGUE_DIRECTORY_COLUMNS, CATALOGUE_DIRECTORY_COUNT_ENTRIES, buildCatalogueDirectory, catalogueDirectoryCountKey } from "./catalogueDirectory";
import { NAVIGATION_DATA, PRODUCT_NAV, sortProductMenuLinks } from "./productNavigation";

describe("full catalogue directory", () => {
  it("includes all seven catalogue departments and every recorded subcategory", () => {
    const groups = CATALOGUE_DIRECTORY_COLUMNS.flat();
    expect(groups.map((group) => group.category).sort()).toEqual([...taxonomy.categories].sort());
    for (const group of groups) {
      for (const subcategory of taxonomy.subcategories[group.category as keyof typeof taxonomy.subcategories]) {
        expect(group.links.some((link) => link.category === group.category && link.subcategory === subcategory)).toBe(true);
      }
    }
    expect(groups.find((group) => group.category === "Bedroom")?.links.some((link) => link.subcategory === "Bedside Tables")).toBe(true);
  });
  it("sorts each department alphabetically and preserves exact count/routing identities", () => {
    for (const group of CATALOGUE_DIRECTORY_COLUMNS.flat()) {
      expect(group.links.map((link) => link.label)).toEqual([...group.links.map((link) => link.label)].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
      for (const link of group.links) {
        const key = catalogueDirectoryCountKey(link);
        expect(CATALOGUE_DIRECTORY_COUNT_ENTRIES.find((entry) => entry.key === key)).toEqual(expect.objectContaining({ category: link.category, subcategory: link.subcategory, key }));
      }
    }
  });
  it("shares the exact master link arrays with every individual product menu", () => {
    for (const menu of PRODUCT_NAV.filter((entry) => entry.key !== "rooms" && entry.key !== "furniture")) {
      const group = CATALOGUE_DIRECTORY_COLUMNS.flat().find((entry) => entry.category === menu.category);
      expect(group?.links).toBe(menu.links);
      expect(menu.links).toBe(NAVIGATION_DATA.find((entry) => entry.key === menu.key)?.links);
    }
  });
  it("includes Bar Stools under Seating with the existing catalogue destination", () => {
    const seating = CATALOGUE_DIRECTORY_COLUMNS.flat().find((group) => group.category === "Seating");
    expect(seating?.links.find((link) => link.label === "Bar Stools")).toEqual({ label: "Bar Stools", category: "Seating", subcategory: "Ottomans & Stools" });
  });
  it("includes Bedside Tables under Tables with Bedroom count and routing identities", () => {
    const tables = CATALOGUE_DIRECTORY_COLUMNS.flat().find((group) => group.category === "Tables");
    const bedside = tables?.links.find((link) => link.label === "Bedside Tables");
    expect(bedside).toEqual({ label: "Bedside Tables", category: "Bedroom", subcategory: "Bedside Tables" });
    if (!bedside) throw new Error("Missing Bedside Tables");
    expect(catalogueDirectoryCountKey(bedside)).toBe("Bedroom:Bedside Tables");
  });
  it("reflects additions, removals and modifications from the master without another list", () => {
    const data = NAVIGATION_DATA.map((entry) => entry.key === "tables" ? {
      ...entry,
      links: sortProductMenuLinks([
        ...entry.links.filter((link) => link.label !== "Desks").map((link) => link.label === "Side Tables" ? { ...link, label: "Occasional Tables" } : link),
        { label: "Accent Tables", category: "Tables", subcategory: "Accent Tables" },
      ]),
    } : entry);
    const tables = buildCatalogueDirectory(data).flat().find((entry) => entry.category === "Tables");
    expect(tables?.links).toBe(data.find((entry) => entry.key === "tables")?.links);
    expect(tables?.links.map((link) => link.label)).toEqual(["Accent Tables", "Bedside Tables", "Coffee Tables", "Consoles", "Dining Tables", "Occasional Tables"]);
  });
});