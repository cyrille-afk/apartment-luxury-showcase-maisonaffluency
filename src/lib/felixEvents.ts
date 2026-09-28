// Provider-agnostic event emitter for the Felix moodboard generator.
// Dispatches a DOM CustomEvent ("ma:analytics") and forwards to GA (gtag),
// Google Tag Manager (dataLayer) or PostHog when those are present on window.
// To add a provider later, listen for "ma:analytics" or extend `forward`.
type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    posthog?: { capture: (event: string, props?: Props) => void };
  }
}

export function trackFelixEvent(event: string, props: Props = {}) {
  if (typeof window === "undefined") return;
  const payload = { ...props, source: "felix_moodboard", ts: Date.now() };
  try {
    window.dispatchEvent(new CustomEvent("ma:analytics", { detail: { event, props: payload } }));
    window.gtag?.("event", event, payload);
    window.dataLayer?.push({ event, ...payload });
    window.posthog?.capture(event, payload);
  } catch { /* analytics must never break the UI */ }
}
