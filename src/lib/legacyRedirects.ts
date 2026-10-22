/** Old site URLs that permanently redirect (301) to their current page. */
const TO_DESIGNERS = ["products", "shop", "catalog", "catalogue", "collection"];
const TO_HOME_PREFIX = ["test", "preview", "staging"];
const TO_HOME_EXACT = ["/home", "/index.html", "/index.php"];

export function legacyRedirectTarget(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const first = path.split("/")[1]?.toLowerCase() ?? "";
  if (TO_DESIGNERS.includes(first)) return "/designers";
  if (TO_HOME_EXACT.includes(path.toLowerCase()) || TO_HOME_PREFIX.includes(first)) return "/";
  return null;
}
