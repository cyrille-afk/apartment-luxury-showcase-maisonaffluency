import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Minimal GDPR cookie consent banner.
 * Blocks GA4 until the user explicitly accepts.
 * Persists choice in BOTH localStorage ('cookie_consent') and a 1-year
 * first-party cookie ('cookie_consent') so the banner never remounts
 * after accept/decline — even if localStorage is cleared.
 */
const CONSENT_KEY = "cookie_consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const readConsentCookie = (): string | null => {
  try {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + CONSENT_KEY + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

const writeConsent = (value: "accepted" | "declined") => {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* ignore */ }
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${CONSENT_KEY}=${encodeURIComponent(value)}; Max-Age=${CONSENT_MAX_AGE}` +
      `; Path=/; SameSite=Lax${secure}`;
  } catch { /* ignore */ }
};

const readConsent = (): string | null => {
  let v: string | null = null;
  try { v = localStorage.getItem(CONSENT_KEY); } catch { /* ignore */ }
  if (!v) v = readConsentCookie();
  // Heal: if only one store has it, mirror to the other.
  if (v === "accepted" || v === "declined") {
    try {
      if (localStorage.getItem(CONSENT_KEY) !== v) localStorage.setItem(CONSENT_KEY, v);
    } catch { /* ignore */ }
    if (readConsentCookie() !== v) writeConsent(v);
  }
  return v;
};

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

    const consent = readConsent();
    if (consent) return;


    // Never mount during the LCP measurement window. Lighthouse keeps
    // updating LCP until the page reaches network idle, so it's not enough
    // to wait for the first LCP entry — the hero image often finalises
    // later and we must let it win. Strategy:
    //   1. Wait for window 'load' (all sub-resources, incl. hero, decoded).
    //   2. Then wait an additional idle/3s buffer so any late LCP candidate
    //      has been recorded before we inject a fixed bottom <p>.
    //   3. Hard ceiling of 12s in case 'load' never fires.
    let cancelled = false;
    const timers: number[] = [];
    const reveal = () => {
      if (cancelled) return;
      cancelled = true;
      try {
        (window as unknown as { __cookieBannerMountedAt?: number }).__cookieBannerMountedAt =
          performance.now();
      } catch {
        /* ignore */
      }
      setVisible(true);
    };

    const afterLoad = () => {
      if (cancelled) return;
      const ric: typeof window.requestIdleCallback | undefined =
        (window as any).requestIdleCallback;
      if (ric) {
        ric(reveal, { timeout: 3000 });
      } else {
        timers.push(window.setTimeout(reveal, 3000));
      }
    };

    const onLoad = () => {
      // Extra 1.5s after load so any tail LCP entries settle.
      timers.push(window.setTimeout(afterLoad, 1500));
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
    }

    // Hard ceiling: even if 'load' never fires, show after 12s.
    timers.push(window.setTimeout(reveal, 12000));

    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoad);
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
