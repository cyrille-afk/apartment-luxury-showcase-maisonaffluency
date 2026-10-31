export function isCollectionLanding(pathname: string) {
  return pathname.replace(/\/+$/, "") === "/trade/the-collection";
}

export function shouldResetRouteScroll(previousPath: string | null, pathname: string) {
  return previousPath !== pathname || isCollectionLanding(pathname);
}
/** Product detail pages must land instantly — a smooth scroll-to-top from a deep
 *  listing position reads as an "elevator" before the product appears. */
export function isProductDetailPath(pathname: string) {
  const p = pathname.replace(/\/+$/, "");
  return (
    /^\/trade\/products\/[^/]+(\/[^/]+)?$/.test(p) ||
    /^\/products\/[^/]+$/.test(p) ||
    /^\/product\/[^/]+$/.test(p) ||
    /^\/designers\/[^/]+\/[^/]+$/.test(p)
  );
}
