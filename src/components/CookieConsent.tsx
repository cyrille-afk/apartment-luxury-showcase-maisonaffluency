import { useState, useEffect } from "react";
import { Shield } from "lucide-react";

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

const shouldDeferOnDesignersMobileHero = (): boolean => {
  if (typeof window === "undefined") return false;
  if (window.location.pathname !== "/designers") return false;
  if (!window.matchMedia?.("(max-width: 767px)").matches) return false;
  const hero = document.getElementById("designers-hover-hero");
  if (!hero) return false;
  return hero.getBoundingClientRect().bottom > 80;
};

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mobile_preview") === "1") return;
    // Consent is a public-site concern. Never cover authenticated trade/admin
    // workspaces, where the fixed banner can obstruct editor controls.
    if (window.location.pathname.startsWith("/trade")) return;
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
    if (consent) {
      setConsented(true);
      return;
    }


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
    const markMounted = () => {
      try {
        (window as unknown as { __cookieBannerMountedAt?: number }).__cookieBannerMountedAt =
          performance.now();
      } catch {
        /* ignore */
      }
    };

    const showBanner = () => {
      if (cancelled) return;
      cancelled = true;
      markMounted();
      setVisible(true);
    };

    const reveal = () => {
      if (cancelled) return;

      if (shouldDeferOnDesignersMobileHero()) {
        const release = () => {
          window.removeEventListener("unlockDesignersScroll", release);
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
          showBanner();
        };
        const onScroll = () => {
          if (!shouldDeferOnDesignersMobileHero()) release();
        };
        window.addEventListener("unlockDesignersScroll", release, { once: true });
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        return;
      }

      showBanner();
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

  const dismissWithFade = (after?: () => void) => {
    setFading(true);
    window.setTimeout(() => {
      after?.();
      setVisible(false);
      setFading(false);
      setConsented(true);
    }, 300);
  };

  const accept = () => {
    dismissWithFade(() => {
      writeConsent("accepted");
      // Load GA4 immediately
      if (typeof (window as any).__loadGA4 === "function") {
        (window as any).__loadGA4();
      }
    });
  };

  const decline = () => {
    dismissWithFade(() => {
      writeConsent("declined");
      try { localStorage.setItem("ga_optout", "1"); } catch { /* ignore */ }
    });
  };

  const reopen = () => {
    setConsented(false);
    setFading(false);
    setVisible(true);
  };


  return (
    <>
      {visible && (
        <div
          className={`fixed bottom-6 left-6 z-50 max-w-[340px] transition-opacity duration-300 ease-in-out ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="bg-card/70 backdrop-blur-md border border-border/40 rounded-full shadow-lg px-5 py-3 flex items-center gap-4">
            <p className="text-xs tracking-[0.12em] lowercase text-muted-foreground leading-snug flex-1">
              we use cookies to tune your studio ecosystem.
            </p>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={decline}
                className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Preferences
              </button>
              <button
                onClick={accept}
                className="text-xs uppercase tracking-[0.15em] text-foreground hover:text-muted-foreground transition-colors font-medium"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent privacy trigger — reopen settings anytime */}
      {!visible && consented && (
        <button
          onClick={reopen}
          aria-label="Cookie preferences"
          className="fixed bottom-6 left-6 z-50 p-2 text-muted-foreground/50 hover:text-foreground transition-colors duration-300"
        >
          <Shield className="w-3 h-3" />
        </button>
      )}
    </>
  );
};

export const hasCookieConsent = (): boolean => {
  if (typeof window === "undefined") return false;
  try { if (window.localStorage.getItem(CONSENT_KEY) === "accepted") return true; }
  catch { /* ignore */ }
  return readConsentCookie() === "accepted";
};


export default CookieConsent;
