/** Keep editorial exploration in its originating Trade workspace. */
export function designerBrowsePath(slug: string, insideTrade: boolean, section: "profile" | "biography" = "profile") {
  return insideTrade ? `/trade/gallery/${slug}/${section}` : `/designers/${slug}${section === "biography" ? "/biography" : ""}`;
}
export function productBrowsePath(designer: string, product: string, insideTrade: boolean) {
  return `${insideTrade ? "/trade/products" : "/designers"}/${designer}/${product}`;
}
export function isTradeDesignerBrowse(path: string) {
  return /^\/trade\/gallery\/[^/]+(?:\/(?:profile|biography))?\/?$/.test(path);
}
