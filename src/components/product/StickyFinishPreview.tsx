import { useEffect, useRef, useState } from "react";

interface StickyFinishPreviewProps {
  /** Element whose visibility pins/unpins the preview (the finish section). */
  anchorRef: React.RefObject<HTMLElement>;
  imageUrl: string | null | undefined;
  alt: string;
}

/**
 * Mobile-only floating thumbnail that mirrors the gallery's current image
 * while the user is interacting with the finish/variant dropdowns. Pinned to
 * the top-right of the viewport whenever the anchor section is on screen,
 * so picking a finish gives immediate visual feedback without scrolling
 * back up to the gallery.
 */
const StickyFinishPreview = ({ anchorRef, imageUrl, alt }: StickyFinishPreviewProps) => {
  const [visible, setVisible] = useState(false);
  const lastUrl = useRef<string | null | undefined>(imageUrl);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "0px 0px -20% 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [anchorRef]);

  // Brief pulse animation when the image changes to draw the eye.
  useEffect(() => {
    if (imageUrl && imageUrl !== lastUrl.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 450);
      lastUrl.current = imageUrl;
      return () => clearTimeout(t);
    }
    lastUrl.current = imageUrl;
  }, [imageUrl]);

  if (!visible || !imageUrl) return null;

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="View selected finish in gallery"
      className={[
        "md:hidden fixed right-3 z-40",
        "top-[calc(env(safe-area-inset-top,0px)+72px)]",
        "h-20 w-20 rounded-lg overflow-hidden",
        "border border-border bg-background shadow-lg",
        "transition-transform duration-300",
        pulse ? "scale-110" : "scale-100",
      ].join(" ")}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <img
        src={imageUrl}
        alt={alt}
        className="h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />
      <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[9px] uppercase tracking-[0.12em] py-0.5 text-center font-body">
        Preview
      </span>
    </button>
  );
};

export default StickyFinishPreview;
