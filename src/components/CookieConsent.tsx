import { useState, useEffect, useCallback } from "react";
import { Shield } from "lucide-react";
import {
  ALLOW_ALL,
  DENY_ALL,
  CONSENT_EVENT,
  type ConsentScopes,
  bootstrapConsent,
  getScopes,
  needsConsentPrompt,
  saveConsent,
} from "@/lib/consent/consentStore";

/**
 * GDPR / CNIL compliant consent layer.
 *
 * Layer 1 — three equally weighted actions: Accept All, Reject All,
 *           Manage Preferences. No dark patterns, no pre-ticked boxes.
 * Layer 2 — granular per-category toggles (necessary locked on).
 * Always  — a persistent shield trigger so consent can be withdrawn anytime.
 *
 * Runs on every surface: public routes, /trade/* and the installed PWA.
 */

const CATEGORIES: {
  key: keyof ConsentScopes;
  label: string;
  description: string;
  locked?: boolean;
}[] = [
  {
    key: "necessary",
    label: "Strictly necessary",
    description:
      "Sign-in, basket, security and fraud prevention. Required for the site to work.",
    locked: true,
  },
  {
    key: "functional",
    label: "Functional",
    description:
      "Remembers your currency, saved views and concierge conversation preferences.",
  },
  {
    key: "analytics",
    label: "Analytics",
    description:
      "Anonymous measurement of pages and journeys so we can improve the experience.",
  },
  {
    key: "marketing",
    label: "Marketing & targeting",
    description:
      "Advertising measurement and advanced fraud telemetry from our payment partner.",
  },
];

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
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState<ConsentScopes>(DENY_ALL);

  useEffect(() => {
    bootstrapConsent();
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mobile_preview") === "1") return;
    if (!needsConsentPrompt()) return;

    let cancelled = false;
    const timers: number[] = [];

    const showBanner = () => {
      if (cancelled) return;
      cancelled = true;
      try {
        (window as unknown as { __cookieBannerMountedAt?: number }).__cookieBannerMountedAt =
          performance.now();
      } catch {
        /* ignore */
      }
      setDraft(getScopes());
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
      const ric: typeof window.requestIdleCallback | undefined = (window as any)
        .requestIdleCallback;
      if (ric) ric(reveal, { timeout: 3000 });
      else timers.push(window.setTimeout(reveal, 3000));
    };

    const onLoad = () => {
      timers.push(window.setTimeout(afterLoad, 1500));
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

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

  const commit = useCallback(
    (scopes: ConsentScopes, method: "accept_all" | "reject_all" | "custom") => {
      setFading(true);
      window.setTimeout(() => {
        saveConsent(scopes, method);
        setVisible(false);
        setManaging(false);
        setFading(false);
      }, 250);
    },
    []
  );

  const reopen = () => {
    setDraft(getScopes());
    setManaging(true);
    setFading(false);
    setVisible(true);
  };

  useEffect(() => {
    const open = () => reopen();
    window.addEventListener("ma-open-consent", open);
    return () => window.removeEventListener("ma-open-consent", open);
  }, []);

  useEffect(() => {
    const onChange = () => setDraft(getScopes());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  const equalButton =
    "flex-1 min-w-[112px] rounded-full border border-border/60 bg-background/80 px-4 py-2 text-[11px] uppercase tracking-[0.15em] text-foreground font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      {visible && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Cookie preferences"
          className={`fixed bottom-4 left-4 right-4 sm:right-auto z-50 sm:max-w-[420px] transition-opacity duration-300 ease-in-out ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="bg-card/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.18em] text-foreground font-medium">
                Your privacy choices
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We use strictly necessary cookies to run this site. With your permission we
                also use functional, analytics and marketing cookies. You can change or
                withdraw your choice at any time.{" "}
                <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                  Privacy policy
                </a>
              </p>
            </div>

            {managing && (
              <ul className="space-y-3 border-t border-border/40 pt-3">
                {CATEGORIES.map((c) => {
                  const checked = c.locked ? true : (draft[c.key] as boolean);
                  return (
                    <li key={c.key} className="flex items-start gap-3">
                      <input
                        id={`consent-${c.key}`}
                        type="checkbox"
                        checked={checked}
                        disabled={c.locked}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [c.key]: e.target.checked }))
                        }
                        className="mt-0.5 h-4 w-4 accent-primary disabled:opacity-60"
                      />
                      <label htmlFor={`consent-${c.key}`} className="flex-1 cursor-pointer">
                        <span className="block text-[11px] uppercase tracking-[0.14em] text-foreground">
                          {c.label}
                          {c.locked && (
                            <span className="ml-2 normal-case tracking-normal text-muted-foreground">
                              (always on)
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground leading-snug">
                          {c.description}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" className={equalButton} onClick={() => commit(DENY_ALL, "reject_all")}>
                Reject all
              </button>
              <button type="button" className={equalButton} onClick={() => commit(ALLOW_ALL, "accept_all")}>
                Accept all
              </button>
              {managing ? (
                <button
                  type="button"
                  className={equalButton}
                  onClick={() => commit({ ...draft, necessary: true }, "custom")}
                >
                  Save choices
                </button>
              ) : (
                <button type="button" className={equalButton} onClick={() => setManaging(true)}>
                  Manage preferences
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!visible && (
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

export const hasCookieConsent = (): boolean => getScopes().analytics;

export default CookieConsent;
