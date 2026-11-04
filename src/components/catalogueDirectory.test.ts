import { describe, expect, it } from "vitest";
import taxonomy from "@/data/productTaxonomy.json";
import { CATALOGUE_DIRECTORY_COLUMNS, CATALOGUE_DIRECTORY_COUNT_ENTRIES } from "./catalogueDirectory";

describe("full catalogue directory", () => {
  it("includes all seven catalogue departments and every recorded subcategory", () => {
    const groups = CATALOGUE_DIRECTORY_COLUMNS.flat();
    expect(groups.map((group) => group.category).sort()).toEqual([...taxonomy.categories].sort());
    for (const group of groups) {
      expect(group.links.map((link) => link.subcategory).sort()).toEqual(
        [...taxonomy.subcategories[group.category as keyof typeof taxonomy.subcategories]].sort(),
      );
    }
    expect(groups.find((group) => group.category === "Bedroom")?.links.some((link) => link.subcategory === "Bedside Tables")).toBe(true);
  });
  it("sorts each department alphabetically and preserves exact count/routing identities", () => {
    for (const group of CATALOGUE_DIRECTORY_COLUMNS.flat()) {
      expect(group.links.map((link) => link.label)).toEqual([...group.links.map((link) => link.label)].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
      for (const link of group.links) {
        expect(CATALOGUE_DIRECTORY_COUNT_ENTRIES.find((entry) => entry.key === `${group.category}:${link.label}`)).toEqual({ ...link, key: `${group.category}:${link.label}` });
      }
    }
  });
});