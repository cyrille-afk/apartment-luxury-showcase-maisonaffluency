import { useEffect, useRef, type RefObject } from "react";

/** Downward dismissal only at the top of the touched scroll area. */
export function useMobileSwipeDismiss({ containerRef, enabled, onDismiss }: {
  containerRef: RefObject<HTMLElement>;
  enabled: boolean;
  onDismiss: () => void;
}) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!enabled) return;
    let gesture: { x: number; y: number; started: number; distance: number; locked: boolean; panel: HTMLElement } | null = null;
    const restore = () => {
      if (gesture) {
        gesture.panel.style.removeProperty("translate");
        gesture.panel.style.removeProperty("transition-property");
      }
      gesture = null;
    };
    const start = (event: TouchEvent) => {
      restore();
      const panel = containerRef.current;
      const target = event.target;
      if (!panel || !(target instanceof Element) || !panel.contains(target) || event.touches.length !== 1) return;
      if (target.closest("button, a, input, textarea, select, [role=button], [role=slider], [data-swipe-dismiss-ignore]")) return;
      // Sticky grab handles can dismiss from any scroll position; content cannot.
      if (!target.closest("[data-swipe-dismiss-handle]")) {
        let node: Element | null = target;
        while (node && panel.contains(node)) {
          if (node.scrollTop > 0 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return;
          if (node === panel) break;
          node = node.parentElement;
        }
      }
      const touch = event.touches[0];
      gesture = { x: touch.clientX, y: touch.clientY, started: performance.now(), distance: 0, locked: false, panel };
    };
    const move = (event: TouchEvent) => {
      if (!gesture) return;
      if (event.touches.length !== 1) { restore(); return; }
      const dx = event.touches[0].clientX - gesture.x;
      const dy = event.touches[0].clientY - gesture.y;
      if (!gesture.locked) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
        if (dy <= 0 || dy <= Math.abs(dx) * 1.25) { restore(); return; }
        gesture.locked = true;
      }
      if (!event.cancelable) { restore(); return; }
      event.preventDefault();
      gesture.distance = Math.max(0, dy);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gesture.panel.style.setProperty("transition-property", "none");
        gesture.panel.style.setProperty("translate", `0 ${gesture.distance}px`);
      }
    };
    const end = () => {
      if (!gesture) return;
      const { distance, started, locked, panel } = gesture;
      const dismiss = locked && (distance >= 100 || (distance >= 40 && distance / Math.max(1, performance.now() - started) >= 0.6));
      panel.style.removeProperty("transition-property");
      // The close lifecycle supplies the exit animation; rejected gestures snap back.
      if (!dismiss && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        panel.animate([{ translate: `0 ${distance}px` }, { translate: "0 0" }], { duration: 180, easing: "ease-out" });
      }
      restore();
      if (dismiss) dismissRef.current();
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", restore);
    return () => {
      restore();
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", restore);
    };
  }, [containerRef, enabled]);
}