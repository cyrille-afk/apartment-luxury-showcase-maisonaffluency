import taxonomy from "@/data/productTaxonomy.json";
import type { ProductMenuLink } from "./productMenuImages";

export interface CatalogueDirectoryGroup {
  category: string;
  links: ProductMenuLink[];
}

/** Use the complete catalogue taxonomy, not the shorter featured-menu lists. */
export const CATALOGUE_DIRECTORY_COLUMNS: CatalogueDirectoryGroup[][] = [
  ["Tables", "Bedroom"],
  ["Seating", "Storage"],
  ["Lighting", "Rugs"],
  ["Décor"],
].map((categories) => categories.map((category) => ({
  category,
  links: (taxonomy.subcategories[category as keyof typeof taxonomy.subcategories] ?? [])
    .map((subcategory) => ({ label: subcategory, category, subcategory }))
    .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" })),
})));

export const CATALOGUE_DIRECTORY_COUNT_ENTRIES = CATALOGUE_DIRECTORY_COLUMNS.flatMap((column) =>
  column.flatMap((group) => group.links.map((link) => ({ ...link, key: `${link.category}:${link.subcategory}` }))),
);