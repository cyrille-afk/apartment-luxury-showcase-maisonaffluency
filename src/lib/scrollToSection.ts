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
export function scrollToSection(id: string, behavior: ScrollBehavior = "smooth") {
  const navHeight = 96;
  // Extra padding for sections that need more breathing room below the nav
  const isMobile = window.innerWidth < 768;
  const extraOffset: Record<string, number> = {
    "sociable-environment": isMobile ? 16 : 40,
  };
  const instant = "instant" as ScrollBehavior;

  // How far above the target we back up before smooth-scrolling in (px).
  // This lets users see nearby content (parallax interludes, etc.)
  const LEAD_IN_DISTANCE = isMobile ? 800 : 1200;

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
      // Use a real delay (not just rAF) so the browser has time to lay out
      // content-visibility sections that just became visible.
      setTimeout(() => requestAnimationFrame(refine), 60);
      return;
    }

    // Settled — now back up and smooth-scroll in so the user sees nearby content.
    // Only apply lead-in when the scroll distance is large enough to warrant it;
    // for nearby sections (like overview right below hero) just smooth-scroll directly.
    if (behavior === "smooth") {
      const scrollDistance = Math.abs(nextTop - window.scrollY);
      if (scrollDistance > LEAD_IN_DISTANCE * 1.5) {
        const leadInY = Math.max(0, nextTop - LEAD_IN_DISTANCE);
        window.scrollTo({ top: leadInY, behavior: instant });
        // Small delay so the instant jump completes before smooth scroll begins
        requestAnimationFrame(() => {
          window.scrollTo({ top: nextTop, behavior: "smooth" });
        });
      } else {
        window.scrollTo({ top: nextTop, behavior: "smooth" });
      }
    } else {
      window.scrollTo({ top: nextTop, behavior });
    }
  };

  // Double-rAF to let the initial jump trigger content-visibility rendering,
  // then start the settle loop with delays.
  requestAnimationFrame(() => requestAnimationFrame(refine));
}

