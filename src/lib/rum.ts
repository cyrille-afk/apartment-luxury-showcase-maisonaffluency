/**
 * Real-user monitoring for Largest Contentful Paint.
 *
 * Reports the final LCP value (after the page is hidden / unloaded, when
 * the metric is settled per Web Vitals spec) to GA4 via the same `gtag`
 * pipeline used by the rest of the app. Each event is annotated with:
 *
 *  - whether the cookie banner had already mounted at LCP time
 *  - the element type + selector + size of the LCP candidate
 *  - viewport, device pixel ratio, and effective connection type
 *  - a build id (cache-busting marker), so before/after comparisons of the
 *    cookie-banner gating change can be sliced in GA4.
 *
 * Implementation is dependency-free and only runs in the browser. It is
 * gated on `gtag` being present (i.e. cookie consent accepted) at flush
 * time — we never beacon analytics for users who declined.
 */

declare global {
  interface Window {
    __maRumInit?: boolean;
    __cookieBannerMountedAt?: number;
    gtag?: (...args: unknown[]) => void;
  }
}

type LcpEntry = PerformanceEntry & {
  size?: number;
  element?: Element | null;
  url?: string;
  renderTime?: number;
  loadTime?: number;
};

const BUILD_ID =
  (typeof document !== "undefined" &&
    document.querySelector('meta[name="app-build-id"]')?.getAttribute("content")) ||
  "unknown";

const describeElement = (el: Element | null | undefined): string => {
  if (!el) return "none";
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls =
    (el as HTMLElement).className && typeof (el as HTMLElement).className === "string"
      ? "." + (el as HTMLElement).className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
  return `${tag}${id}${cls}`.slice(0, 120);
};

const getConnectionType = (): string => {
  const c = (navigator as unknown as { connection?: { effectiveType?: string } })
    .connection;
  return c?.effectiveType ?? "unknown";
};

const send = (lcpMs: number, entry: LcpEntry | null) => {
  // Only beacon for users who accepted cookies (gtag is loaded by __loadGA4
  // after consent). Declines stay analytics-silent.
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  const bannerMountedAt = window.__cookieBannerMountedAt;
  const bannerBeforeLcp =
    typeof bannerMountedAt === "number" && bannerMountedAt <= lcpMs;

  window.gtag("event", "web_vital_lcp", {
    event_category: "Web Vitals",
    // GA4 rounds floats inconsistently — send the integer ms as `value`.
    value: Math.round(lcpMs),
    metric_value_ms: Math.round(lcpMs),
    metric_rating:
      lcpMs <= 2500 ? "good" : lcpMs <= 4000 ? "needs-improvement" : "poor",
    lcp_element_tag: entry?.element?.tagName?.toLowerCase() ?? "unknown",
    lcp_element_selector: describeElement(entry?.element ?? null),
    lcp_element_size: entry?.size ?? 0,
    lcp_element_url: entry?.url ?? "",
    cookie_banner_mounted_before_lcp: bannerBeforeLcp ? 1 : 0,
    cookie_banner_mounted_at_ms:
      typeof bannerMountedAt === "number" ? Math.round(bannerMountedAt) : -1,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    connection_type: getConnectionType(),
    build_id: BUILD_ID,
    page_path: window.location.pathname,
    non_interaction: true,
  });
};

export const initRum = () => {
  if (typeof window === "undefined" || window.__maRumInit) return;
  window.__maRumInit = true;

  if (
    typeof PerformanceObserver === "undefined" ||
    !PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint")
  ) {
    return;
  }

  let lastEntry: LcpEntry | null = null;
  let reported = false;

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries() as LcpEntry[];
    if (entries.length > 0) {
      lastEntry = entries[entries.length - 1];
    }
  });

  try {
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    return;
  }

  const flush = () => {
    if (reported || !lastEntry) return;
    reported = true;
    try {
      observer.takeRecords();
    } catch {
      /* ignore */
    }
    observer.disconnect();
    const t = lastEntry.renderTime || lastEntry.loadTime || lastEntry.startTime;
    send(t, lastEntry);
  };

  // Per Web Vitals spec, LCP is finalised on first input or visibility change
  // to hidden — whichever comes first. pagehide is the most reliable signal
  // on bfcache + iOS Safari.
  addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") flush();
    },
    { once: false }
  );
  addEventListener("pagehide", flush, { once: true });
  // First user interaction also finalises LCP.
  ["keydown", "click"].forEach((ev) =>
    addEventListener(ev, flush, { once: true, capture: true })
  );
};
