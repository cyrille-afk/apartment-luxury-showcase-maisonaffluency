import { useRef, useState, useCallback, useEffect } from "react";

interface PinchZoomImageProps {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  draggable?: boolean;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  fetchPriority?: "high" | "low" | "auto";
  style?: React.CSSProperties;
  onZoomChange?: (zoomed: boolean) => void;
}

const PinchZoomImage = ({
  src,
  alt,
  className = "",
  onLoad,
  draggable = false,
  loading,
  decoding,
  fetchPriority,
  style,
  onZoomChange,
}: PinchZoomImageProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isZoomed, setIsZoomed] = useState(false);

  // Pinch state
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const lastTap = useRef(0);

  // Pan state
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  // Refs for latest values (used in native event listeners)
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const translateRef = useRef(translate);
  translateRef.current = translate;

  const updateZoom = useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed);
    onZoomChange?.(zoomed);
  }, [onZoomChange]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    updateZoom(false);
  }, [updateZoom]);

  // Reset when src changes
  useEffect(() => {
    resetZoom();
  }, [src, resetZoom]);

  const getDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Use native (non-passive) event listeners to ensure preventDefault works
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    console.log("[PinchZoom] Attaching native touch listeners to", el.tagName, el.className);

    const handleTouchStart = (e: TouchEvent) => {
      console.log("[PinchZoom] touchstart fires, touches:", e.touches.length, "scale:", scaleRef.current);
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        initialDistance.current = getDistance(e.touches);
        initialScale.current = scaleRef.current;
        console.log("[PinchZoom] pinch start, initialDist:", initialDistance.current);
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        e.preventDefault();
        e.stopPropagation();
        isPanning.current = true;
        panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        translateStart.current = { ...translateRef.current };
      } else if (e.touches.length === 1) {
        const now = Date.now();
        const dt = now - lastTap.current;
        console.log("[PinchZoom] single tap, dt since last:", dt);
        if (dt < 300) {
          e.preventDefault();
          e.stopPropagation();
          if (scaleRef.current > 1) {
            resetZoom();
          } else {
            setScale(2.5);
            updateZoom(true);
            console.log("[PinchZoom] double-tap zoom IN");
          }
        }
        lastTap.current = now;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const dist = getDistance(e.touches);
        const newScale = Math.min(Math.max(initialScale.current * (dist / initialDistance.current), 1), 5);
        setScale(newScale);
        updateZoom(newScale > 1);
        if (newScale <= 1) {
          setTranslate({ x: 0, y: 0 });
        }
      } else if (e.touches.length === 1 && isPanning.current && scaleRef.current > 1) {
        e.preventDefault();
        e.stopPropagation();
        const dx = e.touches[0].clientX - panStart.current.x;
        const dy = e.touches[0].clientY - panStart.current.y;
        setTranslate({
          x: translateStart.current.x + dx,
          y: translateStart.current.y + dy,
        });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isPanning.current || scaleRef.current > 1) {
        e.stopPropagation();
      }
      isPanning.current = false;
      if (scaleRef.current <= 1.05) {
        resetZoom();
      }
    };

    // { passive: false } is critical — allows preventDefault() to work on mobile
    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [resetZoom, updateZoom]);

  return (
    <div
      ref={containerRef}
      className="touch-none"
      style={{ touchAction: "none", overflow: isZoomed ? "hidden" : undefined }}
    >
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          ...style,
          touchAction: "none",
          transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
          transformOrigin: "center center",
          transition: isPanning.current ? "none" : "transform 0.2s ease-out",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        onLoad={onLoad}
        draggable={draggable}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
      />
    </div>
  );
};

export default PinchZoomImage;
