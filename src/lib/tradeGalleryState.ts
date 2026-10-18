export interface TradeGalleryState {
  search: string;
  brand: string;
  category: string;
  subcategory: string;
  edition: string;
  sortBy: "curated" | "designer" | "title" | "recent";
  viewMode: "grid" | "list";
  scrollY: number;
}
const PREFIX = "ma-trade-gallery-v1:";
export function isTradeGalleryListing(path: string) {
  return /^\/trade\/gallery(?:\/[^/]+)?\/?$/.test(path);
}
export function readTradeGalleryState(path: string): Partial<TradeGalleryState> {
  try { return JSON.parse(sessionStorage.getItem(PREFIX + path) || "{}"); } catch { return {}; }
}
export function saveTradeGalleryState(path: string, state: TradeGalleryState, search: string) {
  if (!isTradeGalleryListing(path)) return;
  try {
    sessionStorage.setItem(PREFIX + path, JSON.stringify(state));
    sessionStorage.setItem(PREFIX + "return", path + search);
  } catch { /* Storage may be disabled. */ }
}
export function tradeGalleryReturnPath() {
  try {
    const path = sessionStorage.getItem(PREFIX + "return");
    if (path && isTradeGalleryListing(path.split("?")[0])) return path;
  } catch { /* Use the normal Trade entry. */ }
  return "/trade/the-collection?tab=designers";
}