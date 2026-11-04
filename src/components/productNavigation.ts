// Data-driven Row 3 destinations; room menus keep their editorial layout.
export type ProductNavKey = "rooms" | "furniture" | "seating" | "tables" | "lighting" | "rugs" | "storage" | "decor";
import type { ProductMenuLink } from "./productMenuImages";
type ProductNavLink = ProductMenuLink;
export function sortProductMenuLinks(links: ProductMenuLink[]): ProductMenuLink[] {
  return [...links].sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
}
export const PRODUCT_NAV: { key: ProductNavKey; label: string; title: string; category: string; subcategory?: string; defaultRoom: string; links: ProductNavLink[] }[] = [
  { key: "rooms", label: "By Rooms", title: "By Rooms", category: "Seating", defaultRoom: "living-room", links: [] },
  { key: "furniture", label: "All Categories", title: "All Categories", category: "Seating", defaultRoom: "living-room", links: [
    { label: "Seating", category: "Seating" },
    { label: "Tables", category: "Tables" },
    { label: "Lighting", category: "Lighting" },
    { label: "Rugs", category: "Rugs" },
    { label: "Storage", category: "Storage" },
    { label: "Decor", category: "Décor" },
  ] },
  { key: "seating", label: "Seating", title: "Seating", category: "Seating", defaultRoom: "living-room", links: [
    { label: "Armchairs", category: "Seating", subcategory: "Armchairs" },
    { label: "Bar Stools", category: "Seating", subcategory: "Ottomans & Stools" },
    { label: "Chairs", category: "Seating", subcategory: "Chairs" },
    { label: "Daybeds & Benches", category: "Seating", subcategory: "Daybeds & Benches" },
    { label: "Ottomans & Stools", category: "Seating", subcategory: "Ottomans & Stools" },
    { label: "Sofas", category: "Seating", subcategory: "Sofas" },
  ] },
  { key: "tables", label: "Tables", title: "Tables", category: "Tables", defaultRoom: "dining-room", links: [
    { label: "Bedside Tables", category: "Bedroom", subcategory: "Bedside Tables" },
    { label: "Dining Tables", category: "Tables", subcategory: "Dining Tables" },
    { label: "Coffee Tables", category: "Tables", subcategory: "Coffee Tables" },
    { label: "Side Tables", category: "Tables", subcategory: "Side Tables" },
    { label: "Consoles", category: "Tables", subcategory: "Consoles" },
    { label: "Desks", category: "Tables", subcategory: "Desks" },
  ] },
  { key: "lighting", label: "Lighting", title: "Lighting", category: "Lighting", defaultRoom: "dining-room", links: [
    { label: "Ceiling Lights", category: "Lighting", subcategory: "Ceiling Lights" },
    { label: "Wall Lights", category: "Lighting", subcategory: "Wall Lights" },
    { label: "Table Lights", category: "Lighting", subcategory: "Table Lights" },
    { label: "Floor Lights", category: "Lighting", subcategory: "Floor Lights" },
  ] },
  { key: "rugs", label: "Rugs", title: "Rugs", category: "Rugs", defaultRoom: "living-room", links: [
    { label: "All Rugs", category: "Rugs" },
    { label: "Hand-Knotted Rugs", category: "Rugs", subcategory: "Hand-Knotted Rugs" },
    { label: "Hand-Tufted Rugs", category: "Rugs", subcategory: "Hand-Tufted Rugs" },
    { label: "Hand-Woven Rugs", category: "Rugs", subcategory: "Hand-Woven Rugs" },
  ] },
  { key: "storage", label: "Storage", title: "Storage", category: "Storage", defaultRoom: "dining-room", links: [
    { label: "Bookcases", category: "Storage", subcategory: "Bookcases" },
    { label: "Bars", category: "Storage", subcategory: "Bars" },
    { label: "Cabinets & Sideboards", category: "Storage", subcategory: "Buffets, Cabinets And Sideboards" },
  ] },
  { key: "decor", label: "Decor", title: "Decor", category: "Décor", defaultRoom: "living-room", links: [
    { label: "Mirrors", category: "Décor", subcategory: "Mirrors" },
    { label: "Decorative Objects", category: "Décor", subcategory: "Decorative Objects" },
    { label: "Vases & Vessels", category: "Décor", subcategory: "Vases & Vessels" },
    { label: "Wall Décor", category: "Décor", subcategory: "Wall Décor" },
    { label: "Cushions & Throws", category: "Décor", subcategory: "Cushions & Throws" },
    { label: "Candle Holders", category: "Décor", subcategory: "Candle Holders" },
  ] },
];
