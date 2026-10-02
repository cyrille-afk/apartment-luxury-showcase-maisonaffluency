// GA4 event helpers. The gtag script itself is loaded in index.html with
// consent mode; these helpers fire events only when analytics consent
// has been granted and gtag is available.

import { hasConsent } from "@/lib/consent/consentStore";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function gtagReady(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.gtag === "function" &&
    hasConsent("analytics")
  );
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!gtagReady()) return;
  window.gtag!("event", name, params);
}

export function trackPageView(path: string) {
  if (!gtagReady()) return;
  window.gtag!("event", "page_view", {
    page_path: path,
    page_title: document.title,
  });
}

/** CTA clicks across the site (WhatsApp, email, Instagram, bookings). */
export const trackCTA = {
  whatsapp: (location: string) =>
    trackEvent("click_whatsapp", { event_category: "CTA", event_label: location }),
  email: (location: string) =>
    trackEvent("click_email", { event_category: "CTA", event_label: location }),
  instagram: (location: string, handle?: string) =>
    trackEvent("click_instagram", { event_category: "CTA", event_label: location, handle }),
  bookAppointment: (location: string) =>
    trackEvent("click_book_appointment", { event_category: "CTA", event_label: location }),
};

/** Engagement milestones. */
export const trackEngagement = {
  quoteRequest: (productName: string, designerName: string) =>
    trackEvent("quote_request", {
      event_category: "Engagement",
      product_name: productName,
      designer_name: designerName,
    }),
};

/** Form interaction events. */
export const trackForm = {
  countryChanged: (form: string, from: string, to: string) =>
    trackEvent("form_country_changed", {
      event_category: "Form",
      form,
      from_country: from,
      to_country: to,
    }),
};

/** Trade quick-tour events. */
export const trackTour = {
  stepView: (stepId: string, index: number, total: number) =>
    trackEvent("tour_step_view", { event_category: "Tour", step_id: stepId, step_index: index, total_steps: total }),
  complete: (lastStepId: string, total: number) =>
    trackEvent("tour_complete", { event_category: "Tour", last_step_id: lastStepId, total_steps: total }),
  skip: (lastStepId: string, index: number, total: number) =>
    trackEvent("tour_skip", { event_category: "Tour", last_step_id: lastStepId, step_index: index, total_steps: total }),
};

/** Trade guide events. */
export const trackGuide = {
  pdfDownload: (slug: string, location: string, extra?: Record<string, unknown>) =>
    trackEvent("guide_pdf_download", { event_category: "Trade Guides", guide_slug: slug, event_label: location, ...extra }),
  bannerImpression: (slug: string, location: string) =>
    trackEvent("guide_banner_impression", { event_category: "Trade Guides", guide_slug: slug, event_label: location }),
  bannerClick: (slug: string, location: string) =>
    trackEvent("guide_banner_click", { event_category: "Trade Guides", guide_slug: slug, event_label: location }),
};

let scrollDepthInitialized = false;

/**
 * Fires GA4 engagement events at scroll-depth milestones (25%, 50%, 75%, 90%).
 * Each milestone fires only once per page load. Initialized once globally.
 */
export function initScrollDepthTracking() {
  if (scrollDepthInitialized || typeof window === "undefined") return;
  scrollDepthInitialized = true;

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
}
