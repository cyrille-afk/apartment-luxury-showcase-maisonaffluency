import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Anchored to the live dock, with its ink split at the actual section edge. */
export function DirectoryScrollCue({ hidden }: { hidden: boolean }) {
  const lineRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted || hidden) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = lineRef.current;
      const dock = document.querySelector<HTMLElement>(".directory-search-dock");
      const hero = document.getElementById("designers-hover-hero");
      if (!line || !dock || !hero) return;
      const dockRect = dock.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      const top = Math.max(dockRect.bottom + 12, window.innerHeight - 84);
      line.style.top = `${top}px`;
      line.style.left = `${dockRect.left + dockRect.width / 2}px`;
      line.style.setProperty("--directory-line-boundary", `${heroRect.bottom - top}px`);
      line.dataset.visible = String(window.innerWidth >= 1024 && dockRect.width > 0 && heroRect.bottom > 0);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    const dock = document.querySelector(".directory-search-dock");
    const hero = document.getElementById("designers-hover-hero");
    if (dock) observer.observe(dock);
    if (hero) observer.observe(hero);
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [mounted, hidden]);

  if (!mounted || hidden) return null;
  return createPortal(
    <div ref={lineRef} className="directory-scroll-cue" aria-hidden="true">
      <span className="directory-scroll-cue-track" />
      <span className="directory-scroll-cue-pulse" />
    </div>,
    document.body,
  );
}