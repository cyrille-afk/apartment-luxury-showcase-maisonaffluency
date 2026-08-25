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

/** Lightweight environment fingerprint for richer engagement analytics. */
const getDeviceContext = () => {
  if (typeof window === "undefined") {
    return {
      device_type: "ssr",
      viewport: "0x0",
      referrer_host: "(none)",
      referrer_path: "(none)",
      pwa_standalone: false,
      language: "unknown",
      pixel_ratio: 1,
    };
  }
  const ua = navigator.userAgent || "";
  const w = window.innerWidth;
  const isTablet = /iPad|Tablet/i.test(ua) || (w >= 768 && w < 1024 && /Mobi/i.test(ua));
  const isMobile = !isTablet && (/Mobi|Android|iPhone/i.test(ua) || w < 768);
  const device_type = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
  const platform = /iPhone|iPad|iPod/i.test(ua)
    ? "ios"
    : /Android/i.test(ua)
    ? "android"
    : /Mac/i.test(ua)
    ? "macos"
    : /Windows/i.test(ua)
    ? "windows"
    : "other";

  let referrer_host = "(direct)";
  let referrer_path = "(direct)";
  try {
    if (document.referrer) {
      const r = new URL(document.referrer);
      referrer_host = r.hostname || "(unknown)";
      referrer_path = r.pathname || "/";
    }
  } catch {
    /* ignore */
  }

  const standalone =
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as any).standalone === true;

  return {
    device_type,
    platform,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pixel_ratio: window.devicePixelRatio || 1,
    referrer_host,
    referrer_path,
    page_path: window.location.pathname + window.location.search,
    pwa_standalone: !!standalone,
    language: navigator.language || "unknown",
    connection_type:
      ((navigator as any).connection && (navigator as any).connection.effectiveType) || "unknown",
  };
};

/**
 * Trade Guides analytics — banner impressions, banner clicks, and PDF
 * downloads. All events ride along with device/referrer context so we can
 * segment engagement by mobile vs desktop, source surface, and entry point.
 */
export const trackGuide = {
  bannerImpression: (slug: string, source: string) =>
    trackEvent("guide_banner_impression", {
      event_category: "Trade Guides",
      event_label: slug,
      guide_slug: slug,
      source,
      ...getDeviceContext(),
    }),

  bannerClick: (slug: string, source: string) =>
    trackEvent("guide_banner_click", {
      event_category: "Trade Guides",
      event_label: slug,
      guide_slug: slug,
      source,
      ...getDeviceContext(),
    }),

  pdfDownload: (
    slug: string,
    source: string,
    extra?: GAEventParams
  ) =>
    trackEvent("guide_pdf_download", {
      event_category: "Trade Guides",
      event_label: slug,
      guide_slug: slug,
      source,
      pdf_url: `/guides/${slug}.pdf`,
      ...getDeviceContext(),
      ...(extra ?? {}),
    }),
};

/**
 * Featured free magazine analytics — DEPRECATED.
 *
 * The AD free-download flow has been removed from the trade area. These
 * helpers are retained as no-ops so any lingering imports keep compiling,
 * but they no longer emit GA events or hit the `log-magazine-event` edge
 * function. Safe to delete once we confirm nothing external still calls
 * them.
 */
export const trackMagazine = {
  badgeImpression: (_documentId: string, _title: string, _source: string) => {
    /* no-op: AD free-download flow removed */
  },
  badgeClick: (_documentId: string, _title: string, _source: string) => {
    /* no-op: AD free-download flow removed */
  },
};

/**
 * Quick Tour analytics — measure progression through the first-login flow,
 * including sub-step pill clicks (e.g. Procurement & delivery → Order Timeline)
 * so we can see which procurement tools new trade users adopt first.
 */
/** Persist a tour event to Supabase for the admin funnel dashboard. */
const persistTourEvent = (row: Record<string, unknown>) => {
  import("@/integrations/supabase/client")
    .then(async ({ supabase }) => {
      let user_id: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        user_id = data.session?.user?.id ?? null;
      } catch { /* ignore */ }
      void supabase.from("tour_events").insert({ ...row, user_id } as any);
    })
    .catch(() => {});
};

export const trackTour = {
  stepView: (stepId: string, stepIndex: number, totalSteps: number) => {
    const ctx = getDeviceContext();
    trackEvent("tour_step_view", {
      event_category: "Onboarding",
      event_label: stepId,
      step_id: stepId,
      step_index: stepIndex,
      total_steps: totalSteps,
      ...ctx,
    });
    persistTourEvent({
      event_type: "tour_step_view",
      step_id: stepId,
      step_index: stepIndex,
      total_steps: totalSteps,
      device_type: ctx.device_type,
      platform: (ctx as any).platform,
      viewport: ctx.viewport,
      pwa_standalone: ctx.pwa_standalone,
      language: ctx.language,
      page_path: (ctx as any).page_path,
      referrer_host: ctx.referrer_host,
    });
  },

  subStepClick: (parentStepId: string, subStepId: string, label: string, path: string) => {
    const ctx = getDeviceContext();
    trackEvent("tour_substep_click", {
      event_category: "Onboarding",
      event_label: `${parentStepId}/${subStepId}`,
      parent_step_id: parentStepId,
      sub_step_id: subStepId,
      sub_step_label: label,
      target_path: path,
      ...ctx,
    });
    persistTourEvent({
      event_type: "tour_substep_click",
      step_id: parentStepId,
      sub_step_id: subStepId,
      sub_step_label: label,
      target_path: path,
      device_type: ctx.device_type,
      platform: (ctx as any).platform,
      viewport: ctx.viewport,
      pwa_standalone: ctx.pwa_standalone,
      language: ctx.language,
      page_path: (ctx as any).page_path,
      referrer_host: ctx.referrer_host,
    });
  },

  complete: (lastStepId: string, totalSteps: number) => {
    const ctx = getDeviceContext();
    trackEvent("tour_complete", {
      event_category: "Onboarding",
      event_label: lastStepId,
      total_steps: totalSteps,
      ...ctx,
    });
    persistTourEvent({
      event_type: "tour_complete",
      step_id: lastStepId,
      total_steps: totalSteps,
      device_type: ctx.device_type,
      platform: (ctx as any).platform,
      viewport: ctx.viewport,
      pwa_standalone: ctx.pwa_standalone,
      language: ctx.language,
      page_path: (ctx as any).page_path,
      referrer_host: ctx.referrer_host,
    });
  },

  skip: (atStepId: string, atIndex: number, totalSteps: number) => {
    const ctx = getDeviceContext();
    trackEvent("tour_skip", {
      event_category: "Onboarding",
      event_label: atStepId,
      step_id: atStepId,
      step_index: atIndex,
      total_steps: totalSteps,
      ...ctx,
    });
    persistTourEvent({
      event_type: "tour_skip",
      step_id: atStepId,
      step_index: atIndex,
      total_steps: totalSteps,
      device_type: ctx.device_type,
      platform: (ctx as any).platform,
      viewport: ctx.viewport,
      pwa_standalone: ctx.pwa_standalone,
      language: ctx.language,
      page_path: (ctx as any).page_path,
      referrer_host: ctx.referrer_host,
    });
  },
};
