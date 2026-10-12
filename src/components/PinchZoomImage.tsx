import { useRef, useState, useCallback, useEffect } from "react";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  showZoomControls?: boolean;
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
  showZoomControls = false,
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

  // Ref for the latest callback so updateZoom/resetZoom keep a stable identity —
  // an unstable resetZoom re-triggers the [src, resetZoom] effect below and
  // wipes zoom back to scale(1) on every parent re-render.
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const updateZoom = useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed);
    onZoomChangeRef.current?.(zoomed);
  }, []);

  const resetZoom = useCallback(() => {
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    updateZoom(false);
  }, [updateZoom]);

  const zoomBy = (factor: number) => {
    const previous = scaleRef.current;
    const next = Math.min(5, Math.max(1, previous * factor));
    if (next === 1) {
      resetZoom();
      return;
    }
    // The image uses a centered origin; scale the pan offset by the same
    // ratio to keep the viewport's center point stationary.
    const offset = {
      x: translateRef.current.x * next / previous,
      y: translateRef.current.y * next / previous,
    };
    scaleRef.current = next;
    translateRef.current = offset;
    setScale(next);
    setTranslate(offset);
    updateZoom(true);
  };

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
    

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Only prevent default for pinch gestures
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        initialDistance.current = getDistance(e.touches);
        initialScale.current = scaleRef.current;
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTap.current < 300) {
          // Double-tap while zoomed resets the zoom before pan takes over.
          resetZoom();
          lastTap.current = now;
          return;
        }
        lastTap.current = now;
        isPanning.current = true;
        panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        translateStart.current = { ...translateRef.current };
      } else if (e.touches.length === 1) {
        const now = Date.now();
        const dt = now - lastTap.current;
        if (dt < 300) {
          e.preventDefault();
          e.stopPropagation();
          if (scaleRef.current > 1) {
            resetZoom();
          } else {
            setScale(2.5);
            updateZoom(true);
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
    <div className="relative w-full">
    <div
      ref={containerRef}
      className={isZoomed ? "touch-none" : "touch-pan-y"}
      style={{ touchAction: isZoomed ? "none" : "pan-y", overflow: isZoomed ? "hidden" : undefined }}
    >
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          ...style,
          touchAction: isZoomed ? "none" : "pan-y",
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
    {showZoomControls && (
      <TooltipProvider delayDuration={300}>
        <div
          className="absolute bottom-2 right-3 z-50 flex gap-1"
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
        >
          {[
            { label: "Zoom out", icon: Minus, factor: 1 / 1.5, disabled: scale <= 1 },
            { label: "Zoom in", icon: Plus, factor: 1.5, disabled: scale >= 5 },
          ].map(({ label, icon: Icon, factor, disabled }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-11 w-11 border border-border shadow-sm"
                  aria-label={label}
                  disabled={disabled}
                  onClick={(event) => { event.stopPropagation(); zoomBy(factor); }}
                >
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    )}
    </div>
  );
};

export default PinchZoomImage;
