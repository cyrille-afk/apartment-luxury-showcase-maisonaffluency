import { useEffect, useRef, useState } from "react";

export type ScrollDirection = "up" | "down";

interface Options {
  /** Minimum delta before a direction flip is registered (anti-jitter). */
  threshold?: number;
  /** Scroll position below which the direction is always reported as "up". */
  topOffset?: number;
}

/**
 * Tracks whether the user is scrolling up or down, plus the raw scroll offset.
 * Used to coordinate the global navigation bar and the sticky product header.
 */
export function useScrollDirection({ threshold = 6, topOffset = 80 }: Options = {}) {
  const [direction, setDirection] = useState<ScrollDirection>("up");
  const [scrollY, setScrollY] = useState(0);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastY.current = window.scrollY;
    setScrollY(window.scrollY);

    const update = () => {
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY.current;

      if (y <= topOffset) {
        setDirection("up");
        lastY.current = y;
      } else if (Math.abs(delta) >= threshold) {
        setDirection(delta > 0 ? "down" : "up");
        lastY.current = y;
      }

      setScrollY(y);
      ticking.current = false;
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, topOffset]);

  return { direction, scrollY, isScrollingDown: direction === "down" };
}

export default useScrollDirection;
