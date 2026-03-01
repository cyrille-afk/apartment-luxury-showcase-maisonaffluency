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

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
};

export default useScrollDepthTracking;
