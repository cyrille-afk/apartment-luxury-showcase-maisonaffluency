import { useEffect, useRef } from "react";

/**
 * Attaches native (non-passive) touch listeners to a container element
 * to detect horizontal swipes while preventing the browser from
 * rubber-banding / scrolling the page horizontally.
 *
 * Vertical scrolling (touch-action: pan-y) is preserved.
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
  onSwipeLeft: () => void;   // swipe left → go next
  onSwipeRight: () => void;  // swipe right → go previous
  minDistance?: number;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const currentX = useRef<number | null>(null);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const handleStart = (e: TouchEvent) => {
      if (imageZoomedRef.current) return;
      if (e.touches.length > 1) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      currentX.current = null;
      directionLocked.current = null;
    };

    const handleMove = (e: TouchEvent) => {
      if (imageZoomedRef.current) return;
      if (e.touches.length > 1) return;
      if (startX.current === null || startY.current === null) return;

      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      // Lock direction after a small movement threshold
      if (!directionLocked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        directionLocked.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }

      if (directionLocked.current === "horizontal") {
        // Prevent page from scrolling / rubber-banding horizontally
        e.preventDefault();
        currentX.current = e.touches[0].clientX;
      }
      // If vertical, do nothing — let the browser scroll normally
    };

    const handleEnd = () => {
      if (imageZoomedRef.current) return;
      if (startX.current !== null && currentX.current !== null) {
        const distance = startX.current - currentX.current;
        if (distance > minDistance) onSwipeLeft();
        else if (distance < -minDistance) onSwipeRight();
      }
      startX.current = null;
      startY.current = null;
      currentX.current = null;
      directionLocked.current = null;
    };

    el.addEventListener("touchstart", handleStart, { passive: true });
    el.addEventListener("touchmove", handleMove, { passive: false }); // non-passive!
    el.addEventListener("touchend", handleEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleStart);
      el.removeEventListener("touchmove", handleMove);
      el.removeEventListener("touchend", handleEnd);
    };
  }, [enabled, onSwipeLeft, onSwipeRight, minDistance]);
}
