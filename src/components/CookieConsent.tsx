import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Minimal GDPR cookie consent banner.
 * Blocks GA4 until the user explicitly accepts.
 * Stores choice in localStorage as 'cookie_consent'.
 */
const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mobile_preview") === "1") return;
    const isStandaloneHomeLaunch =
      window.location.pathname === "/" &&
      !window.location.hash &&
      (
        new URLSearchParams(window.location.search).get("source") === "pwa" ||
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
      );
    if (isStandaloneHomeLaunch) return;

    const consent = localStorage.getItem("cookie_consent");
    if (consent) return;

    // Never mount during the LCP measurement window — otherwise this banner
    // (fixed, bottom-of-viewport <p>) can be picked as the LCP candidate and
    // tank desktop LCP. Wait for the LCP entry to be reported, then for the
    // page to be idle, then reveal. Fallback timers guarantee the banner
    // eventually appears even if the observer / idle callback never fires.
    let cancelled = false;
    const timers: number[] = [];
    const reveal = () => {
      if (cancelled) return;
      cancelled = true;
      setVisible(true);
    };
    const afterLcp = () => {
      if (cancelled) return;
      const ric: typeof window.requestIdleCallback | undefined =
        (window as any).requestIdleCallback;
      if (ric) {
        ric(reveal, { timeout: 2000 });
      } else {
        timers.push(window.setTimeout(reveal, 800));
      }
    };

    let observer: PerformanceObserver | null = null;
    try {
      if (
        typeof PerformanceObserver !== "undefined" &&
        PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint")
      ) {
        observer = new PerformanceObserver((list) => {
          // Any LCP entry means the browser has a candidate other than us.
          if (list.getEntries().length > 0) {
            observer?.disconnect();
            // Small grace period so LCP can settle on a later, larger candidate.
            timers.push(window.setTimeout(afterLcp, 1200));
          }
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
      }
    } catch {
      /* ignore */
    }

    // Hard ceiling: even if LCP never reports (rare), show after 10s.
    timers.push(window.setTimeout(afterLcp, 10000));

    return () => {
      cancelled = true;
      observer?.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      if (document.documentElement.dataset.mobilePreviewOpen === "1") setVisible(false);
    };
    window.addEventListener("mobile-preview-open-change", sync);
    sync();
    return () => window.removeEventListener("mobile-preview-open-change", sync);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
    // Load GA4 immediately
    if (typeof (window as any).__loadGA4 === "function") {
      (window as any).__loadGA4();
    }
  };

  const decline = () => {
    localStorage.setItem("cookie_consent", "declined");
    localStorage.setItem("ga_optout", "1");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6"
        >
          <div className="max-w-2xl mx-auto bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Close/decline via X */}
            <button
              onClick={decline}
              className="absolute top-3 right-3 sm:hidden text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Decline cookies"
            >
              <X className="w-4 h-4" />
            </button>

            <p className="text-sm text-muted-foreground leading-relaxed flex-1 font-serif pr-6 sm:pr-0">
              We use cookies and local storage to remember your shipping country
              and display currency, and to analyse site performance. By accepting,
              you consent to preference and analytics cookies. Declining keeps
              only what is strictly necessary for the site to function.
            </p>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={decline}
                className="hidden sm:inline-flex text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
              >
                Decline
              </button>
              <button
                onClick={accept}
                className="text-xs uppercase tracking-[0.15em] bg-foreground text-background px-5 py-2.5 rounded hover:opacity-90 transition-opacity font-medium"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const hasCookieConsent = (): boolean => {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem("cookie_consent") === "accepted"; }
  catch { return false; }
};

export default CookieConsent;
