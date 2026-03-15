import { useEffect, useRef } from "react";

/**
 * Detects horizontal swipes inside a lightbox container while preventing
 * browser horizontal rubber-banding. Vertical scrolling remains available.
 */
export function useLightboxSwipe({
  containerRef,
  enabled,
  imageZoomedRef,
  onSwipeLeft,
  onSwipeRight,
  minDistance = 50,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  imageZoomedRef: React.RefObject<boolean>;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  minDistance?: number;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const currentX = useRef<number | null>(null);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);
  const isTrackingGesture = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const resetGesture = () => {
      startX.current = null;
      startY.current = null;
      currentX.current = null;
      directionLocked.current = null;
      isTrackingGesture.current = false;
    };

    const isInsideContainer = (target: EventTarget | null) => {
      const el = containerRef.current;
      return !!el && target instanceof Node && el.contains(target);
    };

    const handleStart = (e: TouchEvent) => {
      if (imageZoomedRef.current) return;
      if (!isInsideContainer(e.target)) return;
      if (e.touches.length !== 1) {
        resetGesture();
        return;
      }

      isTrackingGesture.current = true;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      currentX.current = null;
      directionLocked.current = null;
    };

    const handleMove = (e: TouchEvent) => {
      if (!isTrackingGesture.current || imageZoomedRef.current) return;
      if (e.touches.length !== 1) return;
      if (startX.current === null || startY.current === null) return;

      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      // Lock direction early, with a slight horizontal bias for easier swiping.
      if (!directionLocked.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        const horizontalIntent = Math.abs(dx) > Math.abs(dy) + 2;
        const verticalIntent = Math.abs(dy) > Math.abs(dx) + 2;

        if (horizontalIntent) directionLocked.current = "horizontal";
        else if (verticalIntent) directionLocked.current = "vertical";
      }

      if (directionLocked.current === "horizontal") {
        if (e.cancelable) e.preventDefault();
        currentX.current = e.touches[0].clientX;
      }
    };

    const handleEnd = () => {
      if (!isTrackingGesture.current || imageZoomedRef.current) {
        resetGesture();
        return;
      }

      if (startX.current !== null && currentX.current !== null) {
        const distance = startX.current - currentX.current;
        if (distance > minDistance) onSwipeLeft();
        else if (distance < -minDistance) onSwipeRight();
      }

      resetGesture();
    };

    // Listen at document level so swipe still works reliably in portals/dialogs.
    document.addEventListener("touchstart", handleStart, { passive: true });
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd, { passive: true });
    document.addEventListener("touchcancel", handleEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleStart);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
      document.removeEventListener("touchcancel", handleEnd);
    };
  }, [enabled, containerRef, imageZoomedRef, onSwipeLeft, onSwipeRight, minDistance]);
}
