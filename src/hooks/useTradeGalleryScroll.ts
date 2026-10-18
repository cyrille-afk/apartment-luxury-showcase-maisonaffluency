import { useEffect, useRef } from "react";
import { readTradeGalleryState, saveTradeGalleryState, type TradeGalleryState } from "@/lib/tradeGalleryState";

/** Wait for async catalogue height before restoring; user interaction cancels recovery. */
export function useTradeGalleryScroll(path: string, search: string, state: Omit<TradeGalleryState, "scrollY">, loading: boolean) {
  const target = useRef(readTradeGalleryState(path).scrollY ?? 0);
  const restoring = useRef(target.current > 0);
  const latest = useRef(state);
  latest.current = state;
  const query = useRef(search);
  query.current = search;
  useEffect(() => {
    const save = () => {
      if (window.location.pathname !== path || restoring.current) return;
      target.current = window.scrollY;
      saveTradeGalleryState(path, { ...latest.current, scrollY: target.current }, query.current);
    };
    const cancel = () => { restoring.current = false; };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    return () => {
      saveTradeGalleryState(path, { ...latest.current, scrollY: target.current }, query.current);
      window.removeEventListener("scroll", save);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
    };
  }, [path]);
  useEffect(() => {
    saveTradeGalleryState(path, { ...state, scrollY: target.current }, search);
  }, [path, search, state.search, state.brand, state.category, state.subcategory, state.edition, state.sortBy, state.viewMode]);
  useEffect(() => {
    if (loading || !restoring.current) return;
    let frame = 0;
    let attempts = 0;
    const restore = () => {
      if (!restoring.current) return;
      if (document.documentElement.scrollHeight - window.innerHeight >= target.current || attempts++ > 180) {
        window.scrollTo({ top: target.current, behavior: "instant" });
        restoring.current = false;
      } else frame = requestAnimationFrame(restore);
    };
    frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [loading, path]);
}