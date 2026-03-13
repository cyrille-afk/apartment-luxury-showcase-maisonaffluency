import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initScrollDepthTracking } from "@/lib/analytics";

/**
 * Tracks page views in GA4. Waits for gtag to be available
 * (it loads after a 3s delay for LCP optimization).
 * Also initializes scroll depth tracking on mount.
 */
const usePageTracking = () => {
  const location = useLocation();

  // Initialize scroll depth tracking once
  useEffect(() => {
    initScrollDepthTracking();
  }, []);

  useEffect(() => {
    const sendPageView = () => {
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "page_view", {
          page_path: location.pathname + location.search + location.hash,
          page_title: document.title,
        });
        return true;
      }
      return false;
    };

    // If gtag is already loaded, fire immediately
    if (sendPageView()) return;

    // Otherwise poll until it's ready (max ~6s after page load)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (sendPageView() || attempts > 12) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [location]);
};

export default usePageTracking;
