export function isCollectionLanding(pathname: string) {
  return pathname.replace(/\/+$/, "") === "/trade/the-collection";
}

export function shouldResetRouteScroll(previousPath: string | null, pathname: string) {
  return previousPath !== pathname || isCollectionLanding(pathname);
}

/** Trade arrivals/departures land immediately; same-page options keep their position. */
export function routeScrollBehavior(pathname: string, allowSmooth: boolean, previousPath?: string | null): ScrollBehavior {
  const adminPattern = /(^|\/)admin(?:\/|$|-)|(^|\/)[^/]+-admin(?:\/|$)/;
  const adminPath = adminPattern.test(pathname) || adminPattern.test(previousPath ?? "");
  const tradePattern = /^\/trade(?:\/|$)/;
  const tradeNavigation = tradePattern.test(pathname) || tradePattern.test(previousPath ?? "");
  return allowSmooth && !adminPath && !tradeNavigation ? "smooth" : "instant";
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
