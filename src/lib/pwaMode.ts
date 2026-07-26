const PWA_SESSION_KEY = "__ma_pwa_standalone_session";

/**
 * Detects an installed/standalone app session, including iOS where the first
 * launch is marked by `?source=pwa` and later in-app route changes lose it.
 */
export function isPwaStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const explicitPwaLaunch = params.get("source") === "pwa";
  const compactViewport = window.matchMedia?.("(max-width: 767px)").matches ?? false;
  const standaloneDisplay =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

  // Real installed PWAs must win regardless of viewport. The preview/mobile
  // simulator can also append ?source=pwa; only persist that hint on compact
  // viewports so a later desktop preview is not misclassified as PWA, which
  // would lock /designers and swap desktop hero imagery to curator picks.
  if (standaloneDisplay || (explicitPwaLaunch && compactViewport)) {
    try {
      window.sessionStorage.setItem(PWA_SESSION_KEY, "1");
    } catch {
      /* ignore unavailable storage */
    }
    return true;
  }

  try {
    return compactViewport && window.sessionStorage.getItem(PWA_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}