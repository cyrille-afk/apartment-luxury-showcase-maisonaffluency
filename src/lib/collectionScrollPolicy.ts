export function isCollectionLanding(pathname: string) {
  return pathname.replace(/\/+$/, "") === "/trade/the-collection";
}

export function shouldResetRouteScroll(previousPath: string | null, pathname: string) {
  return previousPath !== pathname || isCollectionLanding(pathname);
}

/** Admin destinations land immediately; same-page options keep their position. */
export function routeScrollBehavior(pathname: string, allowSmooth: boolean): ScrollBehavior {
  const adminPath = /(^|\/)admin(?:\/|$|-)|(^|\/)[^/]+-admin(?:\/|$)/.test(pathname);
  return allowSmooth && !adminPath ? "smooth" : "instant";
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
