import { useEffect } from "react";

/**
 * Forces the document-level robots meta to noindex.
 *
 * index.html ships a static `robots` meta for the indexable majority of the
 * site; react-helmet-async appends its own tag but does not remove that static
 * one, so crawlers can still read "index, follow" on 404 / redirect surfaces.
 * This patches the static tag directly and restores it on unmount.
 */
export function useNoIndex(content = "noindex, follow") {
  useEffect(() => {
    const tags = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="robots"]')
    );
    const previous = tags.map((tag) => [tag, tag.content] as const);
    tags.forEach((tag) => {
      tag.content = content;
    });
    return () => {
      previous.forEach(([tag, value]) => {
        if (tag.isConnected) tag.content = value;
      });
    };
  }, [content]);
}
