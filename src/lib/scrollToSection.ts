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

/** Custom eased scroll with controllable duration */
function animateScroll(from: number, to: number, duration: number) {
  const start = performance.now();

  // Ease-in-out cubic for a natural feel
  const ease = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const step = (now: number) => {
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

export function scrollToSection(id: string, behavior: ScrollBehavior = "smooth") {
  const navHeight = 96;
  const isMobile = window.innerWidth < 768;
  const extraOffset: Record<string, number> = {
    "sociable-environment": isMobile ? 16 : 40,
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
    const y = el.getBoundingClientRect().top + window.scrollY - navHeight - extra + 2;
    return Math.max(0, y);
  };

  const firstTop = getTargetTop();
  if (firstTop === null) return;

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
      window.scrollTo({ top: nextTop, behavior: instant });
      passes += 1;
      setTimeout(() => requestAnimationFrame(refine), 60);
      return;
    }

    // Settled — back up and scroll in so the user sees nearby content.
    // Use the ORIGINAL scroll position to decide if lead-in is warranted,
    // since the settle loop has already jumped us to the target.
    if (behavior === "smooth") {
      const totalDistance = Math.abs(nextTop - originY);
      const MIN_DISTANCE_FOR_LEADIN = 800;
      if (totalDistance > MIN_DISTANCE_FOR_LEADIN) {
        const leadInY = Math.max(0, nextTop - LEAD_IN_DISTANCE);
        window.scrollTo({ top: leadInY, behavior: instant });
        requestAnimationFrame(() => {
          animateScroll(leadInY, nextTop, SCROLL_DURATION);
        });
      } else {
        // Short distance — proportionally shorter animation
        animateScroll(originY, nextTop, 800);
      }
    } else {
      window.scrollTo({ top: nextTop, behavior });
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(refine));
}
