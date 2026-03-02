/**
 * Scroll to a section element by ID with consistent nav offset.
 * Uses a settle-and-correct strategy to handle sections using content-visibility.
 */
export function scrollToSection(id: string, behavior: ScrollBehavior = "smooth") {
  const navHeight = 96;
  const instant = "instant" as ScrollBehavior;

  const getTargetTop = () => {
    const el = document.getElementById(id);
    if (!el) return null;
    const y = el.getBoundingClientRect().top + window.scrollY - navHeight + 2;
    return Math.max(0, y);
  };

  const firstTop = getTargetTop();
  if (firstTop === null) return;

  // First jump near the target to force rendering of content-visibility sections.
  window.scrollTo({ top: firstTop, behavior: instant });

  let passes = 0;
  let previousTop = firstTop;
  const maxPasses = 8;
  const settleThreshold = 1;

  const refine = () => {
    const nextTop = getTargetTop();
    if (nextTop === null) return;

    const delta = Math.abs(nextTop - previousTop);
    previousTop = nextTop;

    if (delta > settleThreshold && passes < maxPasses) {
      window.scrollTo({ top: nextTop, behavior: instant });
      passes += 1;
      requestAnimationFrame(refine);
      return;
    }

    // Final pass uses requested behavior for better UX.
    window.scrollTo({ top: nextTop, behavior });
  };

  requestAnimationFrame(() => requestAnimationFrame(refine));
}

