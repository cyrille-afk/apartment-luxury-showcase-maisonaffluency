/**
 * Scroll to a section element by ID with consistent nav offset.
 * Uses a settle-and-correct strategy to handle sections using content-visibility.
 *
 * content-visibility: auto sections above the target may change height as they
 * render; we use delayed passes (not just rAF) to let the browser finish layout.
 *
 * After settling, we back up slightly and smooth-scroll to the target so users
 * glimpse parallax interludes and other content along the way.
 */

import { beginProgrammaticScroll, endProgrammaticScroll } from "./programmaticScroll";

/** Custom eased scroll with controllable duration */
let activeScrollSequence = 0;

function animateScroll(from: number, to: number, duration: number, shouldContinue: () => boolean = () => true) {
  const start = performance.now();

  // Ease-in-out cubic for a natural feel
  const ease = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const step = (now: number) => {
    if (!shouldContinue()) return;
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const value = from + (to - from) * ease(progress);
    window.scrollTo({ top: value, behavior: "instant" as ScrollBehavior });
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}

export function scrollToSection(id: string, behavior: ScrollBehavior = "smooth", retryUntil = performance.now() + 2500) {
  const scrollSequence = ++activeScrollSequence;
  // Keep the global nav pinned while we drive the page programmatically —
  // otherwise the synthetic downward scroll triggers hide-on-scroll and the
  // target heading lands under a hidden header.
  beginProgrammaticScroll();
  let cancelledByUser = false;
  let cleanupUserCancel = () => {};
  const shouldContinue = () => scrollSequence === activeScrollSequence && !cancelledByUser;

  if (behavior === "smooth") {
    const cancel = () => {
      cancelledByUser = true;
      activeScrollSequence += 1;
      endProgrammaticScroll();
      cleanupUserCancel();
    };
    const opts: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener("wheel", cancel, opts);
    window.addEventListener("touchstart", cancel, opts);
    window.addEventListener("pointerdown", cancel, opts);
    window.addEventListener("keydown", cancel, { once: true });
    cleanupUserCancel = () => {
      endProgrammaticScroll();
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }

  // Measure actual fixed header height (nav + any fixed banners like Featured Read)
  const nav = document.querySelector("nav");
  const banner = document.querySelector("[data-featured-read-banner]");
  const navHeight = (nav?.getBoundingClientRect().height ?? 96)
    + (banner && window.getComputedStyle(banner).position === "fixed" ? banner.getBoundingClientRect().height : 0);
  // Any sticky filter/search bar pinned beneath the nav (e.g. designers directory)
  const stickyBars = Array.from(
    document.querySelectorAll<HTMLElement>("[data-sticky-filter-bar]")
  ).filter((el) => el.offsetParent !== null);
  const stickyHeight = stickyBars.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
  const isMobile = window.innerWidth < 768;
  const extraOffset: Record<string, number> = {
    "sociable-environment": isMobile ? 16 : 40,
    "apartment-tour-heading": 6,
  };
  const instant = "instant" as ScrollBehavior;

  // How far above the target we back up before scrolling in (px).
  // Should cover roughly one parallax interlude (~50-70vh) without
  // reaching into the previous section's content.
  // Mobile interludes are 50vh (~400px), desktop 70vh (~700px).
  const LEAD_IN_DISTANCE = isMobile ? 450 : 900;

  // Duration of the lead-in scroll animation in ms.
  const SCROLL_DURATION = isMobile ? 1200 : 1800;

  // Capture where the user is BEFORE any jumps
  const originY = window.scrollY;

  const getTargetTop = () => {
    const el = document.getElementById(id);
    if (!el) return null;
    const extra = extraOffset[id] ?? 0;
    const y = el.getBoundingClientRect().top + window.scrollY - navHeight - stickyHeight - extra + 2;
    return Math.max(0, y);
  };

  const firstTop = getTargetTop();
  if (firstTop === null) {
    if (performance.now() >= retryUntil) endProgrammaticScroll();
    if (performance.now() < retryUntil) {
      window.setTimeout(() => scrollToSection(id, behavior, retryUntil), 80);
    }
    return;
  }

  // First jump near the target to force rendering of content-visibility sections.
  window.scrollTo({ top: firstTop, behavior: instant });

  let passes = 0;
  let previousTop = firstTop;
  const maxPasses = 12;
  const settleThreshold = 2;

  const refine = () => {
    const nextTop = getTargetTop();
    if (nextTop === null) return;

    const delta = Math.abs(nextTop - previousTop);
    previousTop = nextTop;

    if (delta > settleThreshold && passes < maxPasses) {
      if (!shouldContinue()) return;
      window.scrollTo({ top: nextTop, behavior: instant });
      passes += 1;
      setTimeout(() => requestAnimationFrame(refine), 60);
      return;
    }

    // Settled — back up and scroll in so the user sees nearby content.
    // Use the ORIGINAL scroll position to decide if lead-in is warranted,
    // since the settle loop has already jumped us to the target.
    if (behavior === "smooth") {
      const directScrollTargets = new Set(["gallery", "meet-designers", "contact", "overview", "apartment-tour", "apartment-tour-heading"]);
      if (directScrollTargets.has(id)) {
        const duration = isMobile ? 900 : 1100;
        animateScroll(originY, nextTop, duration, shouldContinue);

        // Keep correcting while late layout shifts happen (lazy images, iOS
        // hero fallback decode, font swaps). Runs up to ~6s, and also reacts
        // to document height changes via ResizeObserver.
        let correctionPasses = 0;
        let stopped = false;
        let observer: ResizeObserver | null = null;
        const stop = () => {
          if (stopped) return;
          stopped = true;
          observer?.disconnect();
          cleanupUserCancel();
        };
        const correctNow = () => {
          if (stopped || !shouldContinue()) {
            stop();
            return;
          }
          const correctedTop = getTargetTop();
          if (correctedTop !== null && Math.abs(window.scrollY - correctedTop) > 4) {
            window.scrollTo({ top: correctedTop, behavior: instant });
          }
        };
        const correctAfterLazyLayout = () => {
          if (stopped) return;
          if (!shouldContinue()) {
            stop();
            return;
          }
          correctNow();
          correctionPasses += 1;
          if (correctionPasses < 45) window.setTimeout(correctAfterLazyLayout, 130);
          else stop();
        };
        window.setTimeout(correctAfterLazyLayout, duration + 80);
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => {
            if (correctionPasses > 0) correctNow();
          });
          observer.observe(document.documentElement);
        }
        window.addEventListener("load", correctNow, { once: true });
        return;

      }

      const totalDistance = Math.abs(nextTop - originY);
      const MIN_DISTANCE_FOR_LEADIN = 800;
      if (totalDistance > MIN_DISTANCE_FOR_LEADIN) {
        const leadInY = Math.max(0, nextTop - LEAD_IN_DISTANCE);
        window.scrollTo({ top: leadInY, behavior: instant });
        requestAnimationFrame(() => {
          animateScroll(leadInY, nextTop, SCROLL_DURATION, shouldContinue);
          window.setTimeout(cleanupUserCancel, SCROLL_DURATION + 120);
        });
      } else {
        // Short distance — proportionally shorter animation
        animateScroll(originY, nextTop, 800, shouldContinue);
        window.setTimeout(cleanupUserCancel, 920);
      }
    } else {
      window.scrollTo({ top: nextTop, behavior });
      endProgrammaticScroll();
      cleanupUserCancel();
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(refine));
}
