export function isCollectionLanding(pathname: string) {
  return pathname.replace(/\/+$/, "") === "/trade/the-collection";
}

export function shouldResetRouteScroll(previousPath: string | null, pathname: string) {
  return previousPath !== pathname || isCollectionLanding(pathname);
}