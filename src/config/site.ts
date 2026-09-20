/**
 * Single source of truth for the production origin.
 *
 * Every canonical, sitemap <loc>, structured-data URL and share link must be
 * built from this constant. Staging hosts (*.lovable.app), localhost and the
 * apex (non-www) alias are never allowed to leak into emitted URLs. Google has
 * selected https://www.maisonaffluency.com as the canonical host.
 */
export const BASE_URL = "https://www.maisonaffluency.com";

/** Build an absolute production URL from an internal route path. */
export function absoluteUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  // Strip any trailing slash (except the root) so bots never bounce through a
  // redirect between /designers/ and /designers.
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : "/";
  return `${BASE_URL}${clean}`;
}
