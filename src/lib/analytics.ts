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
