/**
 * Google Analytics event tracking utility.
 * Wraps gtag calls so components stay clean.
 */

type GAEventParams = Record<string, string | number | boolean>;

export const trackEvent = (
  eventName: string,
  params?: GAEventParams
) => {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, params);
  }
};

/** Pre-built helpers for common CTA clicks */
export const trackCTA = {
  whatsapp: (source: string) =>
    trackEvent("click_whatsapp", {
      event_category: "CTA",
      event_label: source,
      link_url: "https://wa.me/6591393850",
    }),

  email: (source: string, email = "concierge@myaffluency.com") =>
    trackEvent("click_email", {
      event_category: "CTA",
      event_label: source,
      link_url: `mailto:${email}`,
    }),

  instagram: (source: string, designerName?: string) =>
    trackEvent("click_instagram", {
      event_category: "CTA",
      event_label: designerName ?? source,
      link_domain: "instagram.com",
    }),

  bookAppointment: (source: string) =>
    trackEvent("click_book_appointment", {
      event_category: "CTA",
      event_label: source,
    }),
};

/** Scroll depth tracking — fires once per milestone */
const firedMilestones = new Set<number>();
const MILESTONES = [25, 50, 75, 90, 100];

export const initScrollDepthTracking = () => {
  if (typeof window === "undefined") return;

  const handler = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    const pct = Math.round((scrollTop / docHeight) * 100);

    for (const milestone of MILESTONES) {
      if (pct >= milestone && !firedMilestones.has(milestone)) {
        firedMilestones.add(milestone);
        trackEvent("scroll_depth", {
          event_category: "Engagement",
          percent_scrolled: milestone,
        });
      }
    }
  };

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        handler();
        ticking = false;
      });
    }
  }, { passive: true });
};

/** Engagement event helpers */
export const trackEngagement = {
  lightboxOpen: (productName: string, section: string) =>
    trackEvent("lightbox_open", {
      event_category: "Engagement",
      event_label: productName,
      section,
    }),

  pdfDownload: (productName: string, designer: string) =>
    trackEvent("pdf_download", {
      event_category: "Engagement",
      event_label: productName,
      designer,
    }),

  quoteRequest: (productName: string, designer: string) =>
    trackEvent("quote_request", {
      event_category: "Conversion",
      event_label: productName,
      designer,
    }),

  pinItem: (productName: string, section: string) =>
    trackEvent("pin_item", {
      event_category: "Engagement",
      event_label: productName,
      section,
    }),

  sectionView: (sectionName: string) =>
    trackEvent("section_view", {
      event_category: "Navigation",
      event_label: sectionName,
    }),
};

/** Form interaction events */
export const trackForm = {
  /**
   * Fires when a user overrides the inferred default country in a form.
   * Helps surface mismatches between browser-inferred locale and the user's
   * actual market (e.g. UK visitors correcting a Singapore default).
   */
  countryChanged: (form: string, fromCountry: string, toCountry: string) => {
    if (!fromCountry || !toCountry || fromCountry === toCountry) return;
    trackEvent("form_country_changed", {
      event_category: "Form",
      event_label: form,
      from_country: fromCountry,
      to_country: toCountry,
    });
    // Surface in console for ops visibility while GA propagates.
    if (typeof console !== "undefined") {
      console.info(`[analytics] ${form}: country changed ${fromCountry} → ${toCountry}`);
    }
  },
};
