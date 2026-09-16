import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export const PRODUCTION_CANONICAL_ORIGIN = "https://maisonaffluency.com";

export function buildCanonicalUrl(pathname: string): string {
  return `${PRODUCTION_CANONICAL_ORIGIN}${pathname}`;
}

/**
 * Global self-referencing canonical rule.
 *
 * Every route always publishes a canonical URL pointing to the production
 * apex domain plus the current pathname, regardless of which host (preview,
 * staging, localhost) is serving the page. A runtime guard ensures only one
 * canonical link exists in <head> and removes any duplicates that might be
 * introduced by nested Helmet calls.
 */
export function GlobalCanonical() {
  const { pathname } = useLocation();
  const canonical = buildCanonicalUrl(pathname);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const enforce = () => {
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')
      );

      if (links.length === 0) {
        const link = document.createElement("link");
        link.rel = "canonical";
        link.href = canonical;
        document.head.appendChild(link);
        return;
      }

      // Keep the first canonical and rewrite it to production; remove dupes.
      links[0].setAttribute("href", canonical);
      links.slice(1).forEach((l) => l.remove());
    };

    enforce();

    const observer = new MutationObserver(enforce);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => observer.disconnect();
  }, [canonical]);

  return (
    <Helmet>
      <link rel="canonical" href={canonical} />
    </Helmet>
  );
}
