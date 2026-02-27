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

  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();
      initialDistance.current = getDistance(e.touches);
      initialScale.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      e.stopPropagation();
      isPanning.current = true;
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      translateStart.current = { ...translate };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        e.preventDefault();
        e.stopPropagation();
        if (scale > 1) {
          resetZoom();
        } else {
          setScale(2.5);
          updateZoom(true);
        }
      }
      lastTap.current = now;
    }
  }, [scale, translate, resetZoom, updateZoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();
      const dist = getDistance(e.touches);
      const newScale = Math.min(Math.max(initialScale.current * (dist / initialDistance.current), 1), 5);
      setScale(newScale);
      updateZoom(newScale > 1);
      if (newScale <= 1) {
        setTranslate({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isPanning.current && scale > 1) {
      e.preventDefault();
      e.stopPropagation();
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      setTranslate({
        x: translateStart.current.x + dx,
        y: translateStart.current.y + dy,
      });
    }
  }, [scale, updateZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPanning.current || scale > 1) {
      e.stopPropagation();
    }
    isPanning.current = false;
    if (scale <= 1.05) {
      resetZoom();
    }
  }, [scale, resetZoom]);

  return (
    <div
      ref={containerRef}
      className={isZoomed ? "touch-none" : ""}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ overflow: isZoomed ? "hidden" : undefined }}
    >
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          ...style,
          transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
          transformOrigin: "center center",
          transition: isPanning.current ? "none" : "transform 0.2s ease-out",
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
