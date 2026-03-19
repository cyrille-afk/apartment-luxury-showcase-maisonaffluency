import { useState, useRef, useCallback } from "react";

interface Props {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export default function BeforeAfterSplit({ beforeUrl, afterUrl, beforeLabel = "Before", afterLabel = "After" }: Props) {
  const [split, setSplit] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateSplit = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    setSplit(pct);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSplit(e.clientX);
  }, [updateSplit]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateSplit(e.clientX);
  }, [updateSplit]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden rounded-lg"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ cursor: "col-resize" }}
    >
      {/* After image (full, behind) */}
      <img src={afterUrl} alt={afterLabel} className="absolute inset-0 w-full h-full object-contain" draggable={false} />

      {/* Before image (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${split}%` }}>
        <img
          src={beforeUrl}
          alt={beforeLabel}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ width: `${containerRef.current?.offsetWidth || 0}px`, maxWidth: "none" }}
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 z-10"
        style={{ left: `${split}%`, transform: "translateX(-50%)" }}
      >
        <div className="w-0.5 h-full bg-foreground/80" />
        {/* Handle knob */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border-2 border-foreground/80 flex items-center justify-center shadow-lg">
          <svg width="14" height="14" viewBox="0 0 14 14" className="text-foreground/80">
            <path d="M4 3L1 7l3 4M10 3l3 4-3 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 z-10 bg-background/70 backdrop-blur-sm rounded px-2 py-0.5">
        <span className="font-body text-[10px] font-medium text-foreground">{beforeLabel}</span>
      </div>
      <div className="absolute top-3 right-3 z-10 bg-background/70 backdrop-blur-sm rounded px-2 py-0.5">
        <span className="font-body text-[10px] font-medium text-foreground">{afterLabel}</span>
      </div>
    </div>
  );
}
