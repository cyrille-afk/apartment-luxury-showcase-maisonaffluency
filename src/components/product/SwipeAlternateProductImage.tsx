import { useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

interface SwipeAlternateProductImageProps {
  primarySrc: string;
  primarySrcSet?: string;
  alternateSrc?: string | null;
  alternateSrcSet?: string;
  alt: string;
  sizes: string;
  primaryClassName?: string;
  alternateClassName?: string;
  alternateStyle?: React.CSSProperties;
}

/** Mobile swipe reveals the alternate view; desktop retains the established hover reveal. */
export default function SwipeAlternateProductImage({
  primarySrc,
  primarySrcSet,
  alternateSrc,
  alternateSrcSet,
  alt,
  sizes,
  primaryClassName,
  alternateClassName,
  alternateStyle,
}: SwipeAlternateProductImageProps) {
  const [showAlternate, setShowAlternate] = useState(false);
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || !alternateSrc) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId || !alternateSrc) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 28 && Math.abs(dx) > Math.abs(dy)) {
      suppressClick.current = true;
      setShowAlternate((current) => !current);
    }
  };

  return (
    <div
      className="absolute inset-0 touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }}
    >
      <img
        src={primarySrc}
        srcSet={primarySrcSet}
        sizes={sizes}
        alt={alt}
        className={cn(
          "absolute inset-0 h-full w-full object-contain p-3 transition-all duration-500 ease-out md:p-0 md:object-cover md:duration-700",
          alternateSrc && "md:group-hover:scale-105 md:group-hover:opacity-0",
          showAlternate ? "opacity-0" : "opacity-100",
          primaryClassName
        )}
        loading="lazy"
        draggable={false}
      />
      {alternateSrc && (
        <img
          src={alternateSrc}
          srcSet={alternateSrcSet}
          sizes={sizes}
          alt={`${alt} alternate view`}
          className={cn(
            "absolute inset-0 h-full w-full object-contain p-3 transition-all duration-500 ease-out md:p-0 md:object-cover md:opacity-0 md:duration-700 md:group-hover:scale-105 md:group-hover:opacity-100",
            showAlternate ? "opacity-100" : "opacity-0",
            alternateClassName
          )}
          style={alternateStyle}
          loading="lazy"
          draggable={false}
        />
      )}
    </div>
  );
}