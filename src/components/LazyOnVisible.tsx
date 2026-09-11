import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Defers mounting of children (and therefore any React.lazy imports inside
 * them) until the placeholder scrolls near the viewport. Keeps below-the-fold
 * bundles out of the initial JS/CSS critical path without hurting perceived
 * scroll performance — rootMargin gives the chunk time to fetch before the
 * user reaches it.
 *
 * On first load every stacked placeholder sits inside the same rootMargin, so
 * they all become "visible" at once and React commits them in a single long
 * main-thread task (measured ~130ms+ on throttled mobile, straight into TBT).
 * Off-screen mounts are therefore serialised through a small queue that yields
 * to the browser between each commit; anything actually inside the viewport
 * mounts immediately so scrolling never waits.
 */

type MountTask = () => void;

const pendingMounts: MountTask[] = [];
let draining = false;

const yieldToMain = (): Promise<void> =>
  new Promise((resolve) => {
    const scheduler = (window as any).scheduler;
    if (typeof scheduler?.postTask === "function") {
      void scheduler.postTask(resolve, { priority: "user-visible" });
      return;
    }
    window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
  });

async function drainMounts() {
  if (draining) return;
  draining = true;
  while (pendingMounts.length > 0) {
    const task = pendingMounts.shift();
    task?.();
    if (pendingMounts.length > 0) await yieldToMain();
  }
  draining = false;
}

function queueMount(task: MountTask) {
  pendingMounts.push(task);
  void drainMounts();
}

interface LazyOnVisibleProps {
  children: ReactNode;
  /** CSS min-height for the placeholder so layout doesn't shift when it mounts. */
  minHeight?: string;
  /** IntersectionObserver rootMargin. Default fetches ~one viewport ahead. */
  rootMargin?: string;
  /** Optional id / class passed to the wrapper element. */
  id?: string;
  className?: string;
}

const LazyOnVisible = ({
  children,
  minHeight = "1px",
  rootMargin = "800px 0px",
  id,
  className,
}: LazyOnVisibleProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Fallback: mount after idle so we still get the deferral benefit.
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.disconnect();
          const rect = entry.boundingClientRect;
          const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
          if (inViewport) {
            setVisible(true);
          } else {
            queueMount(() => {
              if (!cancelled) setVisible(true);
            });
          }
          break;
        }
      },
      { rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [rootMargin, visible]);

  return (
    <div ref={ref} id={id} className={className} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
};

export default LazyOnVisible;
