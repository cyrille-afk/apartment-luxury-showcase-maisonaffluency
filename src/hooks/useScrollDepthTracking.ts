import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Fires GA4 engagement events at scroll-depth milestones (25%, 50%, 75%, 90%).
 * Each milestone fires only once per page load.
 * This converts "bounced" sessions into "engaged" sessions in GA4,
 * since any event counts as user engagement.
 */
const useScrollDepthTracking = () => {
  useEffect(() => {
    const thresholds = [25, 50, 75, 90];
    const fired = new Set<number>();
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    let listening = false;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const pct = Math.round((scrollTop / docHeight) * 100);

      for (const t of thresholds) {
        if (pct >= t && !fired.has(t)) {
          fired.add(t);
          trackEvent("scroll_depth", {
            percent_scrolled: t,
            event_category: "Engagement",
            event_label: `${t}%`,
          });
        }
      }
    };

    const startListening = () => {
      if (listening) return;
      listening = true;
      window.addEventListener("scroll", handleScroll, { passive: true });
    };

    // Engagement analytics must not compete with the homepage's first paint.
    // Start during idle time, with a bounded fallback for older mobile browsers.
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(startListening, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(startListening, 1200);
    }

    return () => {
      if (idleId !== null) window.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (listening) window.removeEventListener("scroll", handleScroll);
    };
  }, []);
};

export default useScrollDepthTracking;
