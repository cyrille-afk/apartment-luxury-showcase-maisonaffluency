/**
 * Robust "jump to letter" scroll for the designers directory.
 *
 * Guarantees the targeted letter anchor lands exactly below the fixed nav
 * + any pinned `[data-sticky-filter-bar]` (filter/search row). Designed to
 * survive layout shifts (image loads, AnimatePresence expansions, fonts,
 * iOS PWA safe-area insets) and quick successive clicks via a shared
 * session token: the latest call wins and any in-flight rAF loop bails
 * on the next frame.
 *
 * Offset strategy:
 *  - Header offset is read from the CSS custom property `--header-h`, the
 *    same source of truth used by the `.scroll-header-offset` utility on
 *    the letter anchors. On mobile this variable already folds in
 *    `env(safe-area-inset-top)`, so PWA / installed-app launches land at
 *    the same offset as the browser. We add the visible sticky filter bar
 *    height on top.
 */
import { getDesignersDirectoryAnchor } from "@/lib/designersDirectoryAnchors";

let session = 0;

function remToPx(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.endsWith("rem")) {
    const n = parseFloat(trimmed);
    if (Number.isFinite(n)) {
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return n * root;
    }
  }
  if (trimmed.endsWith("px")) {
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readHeaderOffsetPx(): number {
  // Resolve --header-h. Use a probe element so calc()/env() are computed
  // for us by the browser, which is required because env() inside a CSS
  // variable cannot be parsed manually.
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.height = "var(--header-h)";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  const resolved = probe.getBoundingClientRect().height;
  probe.remove();
  if (resolved > 0) return resolved;
  // Fallback to literal parse, then to nav measurement, then a sane default.
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--header-h");
  const parsed = remToPx(raw);
  if (parsed && parsed > 0) return parsed;
  const nav = document.querySelector("nav");
  return nav?.getBoundingClientRect().height ?? 96;
}

function measureTargetY(letter: string): number | null {
  const el = getDesignersDirectoryAnchor(letter);
  if (!el) return null;
  const headerHeight = readHeaderOffsetPx();
  const stickyBars = Array.from(
    document.querySelectorAll<HTMLElement>("[data-sticky-filter-bar]")
  ).filter((node) => node.offsetParent !== null);
  const stickyHeight = stickyBars.reduce(
    (sum, node) => sum + node.getBoundingClientRect().height,
    0
  );
  return Math.max(
    0,
    el.getBoundingClientRect().top + window.scrollY - headerHeight - stickyHeight - 8
  );
}

export function jumpToDesignerLetter(letter: string) {
  const mySession = ++session;

  const DEADLINE_MS = 1200;
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
  // images further down the page load (which can shift the target). The
  // longer 1500ms pass catches PWA cold-starts where the safe-area inset
  // applies a frame or two after first paint.
  setTimeout(runSettle, 220);
  setTimeout(runSettle, 600);
  setTimeout(runSettle, 1500);
}
