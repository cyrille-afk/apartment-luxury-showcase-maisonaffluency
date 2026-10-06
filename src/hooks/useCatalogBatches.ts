import { useEffect, useRef, useState } from "react";

export const CATALOG_BATCH_SIZE = 24;

export function useCatalogBatches<T>(items: T[], resetKey: string) {
  const [batch, setBatch] = useState({ key: resetKey, count: CATALOG_BATCH_SIZE });
  const count = batch.key === resetKey ? batch.count : CATALOG_BATCH_SIZE;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = count < items.length;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    let frame = 0;
    const append = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setBatch((current) => ({ key: resetKey,
          count: Math.min(items.length, (current.key === resetKey ? current.count : CATALOG_BATCH_SIZE) + CATALOG_BATCH_SIZE),
        }));
      });
    };
    if (typeof IntersectionObserver === "undefined") {
      const onScroll = () => {
        if (sentinel.getBoundingClientRect().top < window.innerHeight + 800) append();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) append();
    }, { rootMargin: "800px 0px" });
    observer.observe(sentinel);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [count, hasMore, items.length, resetKey]);
  return { renderedItems: items.slice(0, count), hasMore, sentinelRef };
}