import { NAVIGATION_DATA, type NavigationCategory } from "./productNavigation";
import type { ProductMenuLink } from "./productMenuImages";

export interface CatalogueDirectoryGroup {
  category: string;
  links: ProductMenuLink[];
}

/** Column placement only; every group's links belong to the shared master. */
export function buildCatalogueDirectory(data: NavigationCategory[]): CatalogueDirectoryGroup[][] {
  return [
  ["Tables", "Bedroom"],
  ["Seating", "Storage"],
  ["Lighting", "Rugs"],
  ["Décor"],
  ].map((categories) => categories.flatMap((category) => {
    const group = data.find((entry) => entry.category === category);
    return group ? [{ category: group.category, links: group.links }] : [];
  }));
}

export const CATALOGUE_DIRECTORY_COLUMNS = buildCatalogueDirectory(NAVIGATION_DATA);

export const catalogueDirectoryCountKey = (link: ProductMenuLink) => `${link.category}:${link.subcategory ?? ""}`;

export const CATALOGUE_DIRECTORY_COUNT_ENTRIES = CATALOGUE_DIRECTORY_COLUMNS.flatMap((column) =>
  column.flatMap((group) => group.links.map((link) => ({ ...link, key: catalogueDirectoryCountKey(link) }))),
);