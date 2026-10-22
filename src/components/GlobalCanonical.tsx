import { useEffect, useState } from "react";
import { useLocation } from "@/lib/router-compat";
import { Helmet } from "react-helmet-async";
import { BASE_URL, absoluteUrl } from "@/config/site";

export const PRODUCTION_CANONICAL_ORIGIN = BASE_URL;

export function buildCanonicalUrl(pathname: string): string {
  return absoluteUrl(pathname);
}

/**
 * Strict self-referencing canonical for any route.
 *
 * Always derived from the live router pathname, never from a database record
 * (slug/id), so one profile can never publish another profile's URL.
 */
export function useSelfCanonical(): string {
  const { pathname } = useLocation();
  return buildCanonicalUrl(pathname);
}

/**
 * Global self-referencing canonical rule.
 *
 * Every route always publishes a canonical URL pointing to the production
 * apex domain plus the current pathname, regardless of which host (preview,
 * staging, localhost) is serving the page. React owns this single canonical;
 * never detach head nodes imperatively, including while routes suspend.
 */
export function GlobalCanonical() {
  const { pathname } = useLocation();
  const canonical = buildCanonicalUrl(pathname);
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const syncStatus = () => setIsNotFound(document.documentElement.dataset.routeStatus === "404");
    syncStatus();
    const observer = new MutationObserver(syncStatus);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-route-status"] });
    return () => observer.disconnect();
  }, [pathname]);

  // Private shared boards (noindex, may be white-labelled) publish no canonical.
  if (isNotFound || pathname.startsWith("/shared/")) return null;

  return (
    <Helmet>
      <link rel="canonical" href={canonical} />
    </Helmet>
  );
}
