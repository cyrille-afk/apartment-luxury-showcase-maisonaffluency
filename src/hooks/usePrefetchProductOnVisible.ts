import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchPublicProductPage } from "@/lib/publicProductPageQuery";

/**
 * Prefetches a public product page once its card scrolls near the viewport.
 *
 * Returns a ref callback to attach to the card element. Uses a single
 * IntersectionObserver per hook instance, prefetches during idle time, and
 * caps how many viewport-triggered prefetches happen per session so a long
 * grid never floods the network.
 */

const MAX_VIEWPORT_PREFETCHES = 24;
let prefetchCount = 0;
const seen = new Set<string>();

function schedule(fn: () => void) {
  if (typeof window === "undefined") return;
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (ric) ric(fn, { timeout: 1500 });
  else window.setTimeout(fn, 200);
}

export function usePrefetchProductOnVisible(
  designerSlug: string | undefined,
  productSlug: string | undefined,
  options?: { rootMargin?: string; enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const rootMargin = options?.rootMargin ?? "400px 0px";
  const enabled = options?.enabled ?? true;

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return useCallback(
    (el: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!el || !enabled || !designerSlug || !productSlug) return;
      if (typeof IntersectionObserver === "undefined") return;

      const key = `${designerSlug}/${productSlug}`;
      if (seen.has(key)) return;

      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            io.disconnect();
            observerRef.current = null;
            if (seen.has(key) || prefetchCount >= MAX_VIEWPORT_PREFETCHES) return;
            seen.add(key);
            prefetchCount += 1;
            schedule(() => prefetchPublicProductPage(queryClient, designerSlug, productSlug));
            break;
          }
        },
        { rootMargin, threshold: 0 },
      );
      io.observe(el);
      observerRef.current = io;
    },
    [queryClient, designerSlug, productSlug, rootMargin, enabled],
  );
}
