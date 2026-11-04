import taxonomy from "@/data/productTaxonomy.json";
import type { ProductMenuLink } from "./productMenuImages";
export type ProductNavKey = "rooms" | "furniture" | "seating" | "tables" | "lighting" | "rugs" | "storage" | "decor";
export interface NavigationCategory {
  key: ProductNavKey | "bedroom";
  label: string;
  title: string;
  category: string;
  subcategory?: string;
  defaultRoom: string;
  links: ProductMenuLink[];
}
export function sortProductMenuLinks(links: readonly ProductMenuLink[]): ProductMenuLink[] {
  return [...links].sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
}
/** Catalogue identities plus navigation-only placements/labels, applied once. */
const categorySettings: Omit<NavigationCategory, "links">[] = [
  { key: "seating", label: "Seating", title: "Seating", category: "Seating", defaultRoom: "living-room" },
  { key: "tables", label: "Tables", title: "Tables", category: "Tables", defaultRoom: "dining-room" },
  { key: "lighting", label: "Lighting", title: "Lighting", category: "Lighting", defaultRoom: "dining-room" },
  { key: "rugs", label: "Rugs", title: "Rugs", category: "Rugs", defaultRoom: "living-room" },
  { key: "storage", label: "Storage", title: "Storage", category: "Storage", defaultRoom: "dining-room" },
  { key: "decor", label: "Decor", title: "Decor", category: "Décor", defaultRoom: "living-room" },
  { key: "bedroom", label: "Bedroom", title: "Bedroom", category: "Bedroom", defaultRoom: "bedroom" },
];
const additionalLinks: Partial<Record<NavigationCategory["key"], ProductMenuLink[]>> = {
  seating: [{ label: "Bar Stools", category: "Seating", subcategory: "Ottomans & Stools" }],
  tables: [{ label: "Bedside Tables", category: "Bedroom", subcategory: "Bedside Tables" }],
  rugs: [{ label: "All Rugs", category: "Rugs" }],
};
const navigationLabels: Record<string, string> = { "Buffets, Cabinets And Sideboards": "Cabinets & Sideboards" };

/** Both views consume these exact arrays; neither owns another subcategory list. */
export const NAVIGATION_DATA: NavigationCategory[] = categorySettings.map((settings) => ({
  ...settings,
  links: sortProductMenuLinks([
    ...taxonomy.subcategories[settings.category as keyof typeof taxonomy.subcategories].map((subcategory) => ({
      label: navigationLabels[subcategory] ?? subcategory, category: settings.category, subcategory,
    })),
    ...(additionalLinks[settings.key] ?? []),
  ]),
}));

export const PRODUCT_NAV: (NavigationCategory & { key: ProductNavKey })[] = [
  { key: "rooms", label: "By Rooms", title: "By Rooms", category: "Seating", defaultRoom: "living-room", links: [] },
  { key: "furniture", label: "All Categories", title: "All Categories", category: "Seating", defaultRoom: "living-room", links: NAVIGATION_DATA.map(({ label, category }) => ({ label, category })) },
  ...NAVIGATION_DATA.filter((menu): menu is NavigationCategory & { key: ProductNavKey } => menu.key !== "bedroom"),
];
