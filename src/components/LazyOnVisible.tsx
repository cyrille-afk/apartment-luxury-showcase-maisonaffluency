import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Defers mounting of children (and therefore any React.lazy imports inside
 * them) until the placeholder scrolls near the viewport. Keeps below-the-fold
 * bundles out of the initial JS/CSS critical path without hurting perceived
 * scroll performance — rootMargin gives the chunk time to fetch before the
 * user reaches it.
 */
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
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, visible]);

  return (
    <div ref={ref} id={id} className={className} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
};

export default LazyOnVisible;
