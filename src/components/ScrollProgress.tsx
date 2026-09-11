import { useEffect, useRef } from "react";

/**
 * Scroll progress bar.
 *
 * Implemented with a passive scroll listener + rAF instead of framer-motion's
 * useScroll/useSpring: this component mounts on the homepage and pulling the
 * animation runtime here forced a ~90ms script-evaluation task during load.
 */
const ScrollProgress = () => {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = barRef.current;
      if (!el) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${progress})`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-1 bg-[hsl(var(--gold))] origin-left z-[100] will-change-transform"
      style={{ transform: "scaleX(0)" }}
    />
  );
};

export default ScrollProgress;
