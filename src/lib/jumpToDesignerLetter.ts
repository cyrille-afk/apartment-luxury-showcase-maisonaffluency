/**
 * Robust "jump to letter" scroll for the designers directory.
 *
 * Guarantees the targeted letter anchor lands exactly below the fixed nav
 * + any pinned `[data-sticky-filter-bar]` (filter/search row). Designed to
 * survive layout shifts (image loads, AnimatePresence expansions, fonts) and
 * quick successive clicks via a shared session token: the latest call wins
 * and any in-flight rAF loop bails on the next frame.
 */
import { getDesignersDirectoryAnchor } from "@/lib/designersDirectoryAnchors";

let session = 0;

function measureTargetY(letter: string): number | null {
  const el = getDesignersDirectoryAnchor(letter);
  if (!el) return null;
  const nav = document.querySelector("nav");
  const navHeight = nav?.getBoundingClientRect().height ?? 96;
  const stickyBars = Array.from(
    document.querySelectorAll<HTMLElement>("[data-sticky-filter-bar]")
  ).filter((node) => node.offsetParent !== null);
  const stickyHeight = stickyBars.reduce(
    (sum, node) => sum + node.getBoundingClientRect().height,
    0
  );
  return Math.max(
    0,
    el.getBoundingClientRect().top + window.scrollY - navHeight - stickyHeight - 8
  );
}

export function jumpToDesignerLetter(letter: string) {
  const mySession = ++session;

  const DEADLINE_MS = 800;
  const STABLE_FRAMES = 4;
  const TOLERANCE_PX = 1;

  const runSettle = () => {
    if (mySession !== session) return;
    const startedAt = performance.now();
    let prev = measureTargetY(letter);
    if (prev === null) return;
    window.scrollTo(0, prev);
    let stableCount = 0;

    const tick = () => {
      if (mySession !== session) return; // a newer click took over
      const y = measureTargetY(letter);
      if (y === null) return;
      const delta = Math.abs(y - prev);
      if (Math.abs(window.scrollY - y) > TOLERANCE_PX) {
        window.scrollTo(0, y);
      }
      stableCount = delta <= TOLERANCE_PX ? stableCount + 1 : 0;
      prev = y;
      if (stableCount >= STABLE_FRAMES) return;
      if (performance.now() - startedAt > DEADLINE_MS) {
        window.scrollTo(0, y);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  runSettle();
  // Re-settle after AnimatePresence / content-visibility expansions and after
  // images further down the page load (which can shift the target).
  setTimeout(runSettle, 220);
  setTimeout(runSettle, 600);
}
