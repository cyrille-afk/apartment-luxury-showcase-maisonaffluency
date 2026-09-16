/**
 * Environment-based indexing guard.
 *
 * Production is the only host allowed to be indexed. Any staging / preview /
 * development host (notably *.lovable.app and localhost) must never leak into
 * Google's index — leaked preview URLs are the main source of Search Console
 * "Not found (404)" reports once a preview sandbox rotates.
 *
 * On a non-production host we:
 *  - force <meta name="robots"> to "noindex, nofollow" (and keep it forced),
 *  - remove the sitemap <link> hint.
 *
 * Canonical URLs are owned by the GlobalCanonical component so this guard no
 * longer touches rel=canonical or og:url — that prevents a DOM fight with
 * react-helmet-async on routes that manage their own Helmet tags.
 */

import { BASE_URL } from "@/config/site";

export const PRODUCTION_ORIGIN = BASE_URL;

const PRODUCTION_HOSTS = new Set([
  "www.maisonaffluency.com",
  "maisonaffluency.com",
]);

export function isProductionHost(hostname?: string): boolean {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();
  return PRODUCTION_HOSTS.has(host);
}

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  const nodes = document.querySelectorAll<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (nodes.length === 0) {
    const tag = document.createElement("meta");
    tag.setAttribute(attr, name);
    tag.content = content;
    document.head.appendChild(tag);
    return;
  }
  nodes.forEach((n) => {
    if (n.content !== content) n.content = content;
  });
}

export function startEnvironmentIndexingGuard() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (isProductionHost()) return;

  const apply = () => {
    setMeta("robots", "noindex, nofollow");
    setMeta("googlebot", "noindex, nofollow");

    document
      .querySelectorAll<HTMLLinkElement>('link[rel="sitemap"]')
      .forEach((link) => link.remove());
  };

  apply();

  // react-helmet-async re-writes head tags on every route change, so keep the
  // guard sticky rather than running it once at boot.
  const observer = new MutationObserver(() => apply());
  observer.observe(document.head, { childList: true, subtree: true, attributes: true });
}
