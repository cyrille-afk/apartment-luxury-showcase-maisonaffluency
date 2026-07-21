import { useState, useEffect, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FadeInImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Wrapper class, e.g. "w-full h-full". Wrapper reserves space so nothing jumps. */
  wrapperClassName?: string;
  /** Skeleton shimmer while loading. Defaults to true. */
  showSkeleton?: boolean;
  /** Duration in ms for the fade. Defaults to 400. */
  fadeDurationMs?: number;
}

/**
 * Progressive image with a reserved-space wrapper + shimmer skeleton +
 * opacity fade-in on load. No layout jumps: the wrapper holds the box,
 * the <img> is absolutely positioned inside it and fades from 0 → 1.
 * Respects `prefers-reduced-motion` via `motion-safe:` / `motion-reduce:`.
 */
export function FadeInImage({
  wrapperClassName,
  className,
  showSkeleton = true,
  fadeDurationMs = 400,
  src,
  onLoad,
  onError,
  loading = "lazy",
  decoding = "async",
  ...imgProps
}: FadeInImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset when src changes so re-mounts fade cleanly.
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden", wrapperClassName)}>
      {showSkeleton && !loaded && !failed && (
        <div
          aria-hidden
          className="absolute inset-0 bg-muted/40 motion-safe:animate-pulse motion-reduce:animate-none"
        />
      )}
      <img
        {...imgProps}
        src={src}
        loading={loading}
        decoding={decoding}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setFailed(true);
          setLoaded(true);
          onError?.(e);
        }}
        style={{
          transitionDuration: `${fadeDurationMs}ms`,
          ...imgProps.style,
        }}
        className={cn(
          "absolute inset-0 w-full h-full transition-opacity ease-out motion-reduce:transition-none",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </div>
  );
}

export default FadeInImage;
