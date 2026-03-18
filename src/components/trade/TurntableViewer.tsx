import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TurntableViewerProps {
  images: string[];
  generating?: boolean;
  onDownload?: (url: string, index: number) => void;
}

const ANGLE_LABELS = [
  "Front (0°)",
  "Front-Right (60°)",
  "Right (120°)",
  "Back (180°)",
  "Back-Left (240°)",
  "Left (300°)",
];

const TurntableViewer = ({ images, generating, onDownload }: TurntableViewerProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartIndex = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalFrames = images.length || ANGLE_LABELS.length;

  const next = useCallback(() => setActiveIndex((i) => (i + 1) % totalFrames), [totalFrames]);
  const prev = useCallback(() => setActiveIndex((i) => (i - 1 + totalFrames) % totalFrames), [totalFrames]);

  // Mouse/touch drag to scrub
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (images.length === 0) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartIndex.current = activeIndex;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeIndex, images.length]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || images.length === 0) return;
    const containerWidth = containerRef.current?.offsetWidth || 600;
    const dx = e.clientX - dragStartX.current;
    const frameDelta = Math.round((dx / containerWidth) * totalFrames * 1.5);
    const newIndex = ((dragStartIndex.current - frameDelta) % totalFrames + totalFrames) % totalFrames;
    setActiveIndex(newIndex);
  }, [isDragging, totalFrames, images.length]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  const label = ANGLE_LABELS[activeIndex] || `View ${activeIndex + 1}`;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="font-display text-xs text-foreground">Orbit Turntable</h3>
        </div>
        <span className="font-body text-[10px] text-muted-foreground">
          {generating ? "Generating views…" : `${images.length} / ${totalFrames} views`}
        </span>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="relative aspect-[4/3] bg-muted/20 select-none"
        style={{ cursor: isDragging ? "grabbing" : images.length > 0 ? "grab" : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {images.length > 0 && images[activeIndex] ? (
          <img
            src={images[activeIndex]}
            alt={label}
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            {generating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="font-body text-xs text-muted-foreground">
                  Generating angle {images.length + 1} of {totalFrames}…
                </p>
              </>
            ) : (
              <p className="font-body text-xs text-muted-foreground">No turntable views yet</p>
            )}
          </div>
        )}

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Angle label overlay */}
        {images.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="font-body text-[10px] text-foreground">{label}</span>
          </div>
        )}
      </div>

      {/* Dot scrubber + download */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalFrames }).map((_, i) => (
            <button
              key={i}
              onClick={() => images[i] && setActiveIndex(i)}
              disabled={!images[i]}
              className={`w-2 h-2 rounded-full transition-all ${
                i === activeIndex
                  ? "bg-foreground scale-125"
                  : images[i]
                    ? "bg-muted-foreground/40 hover:bg-muted-foreground/60"
                    : "bg-muted-foreground/15"
              }`}
            />
          ))}
        </div>
        {images[activeIndex] && onDownload && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => onDownload(images[activeIndex], activeIndex)}
          >
            <Download className="w-3 h-3 mr-1" />
            Download
          </Button>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-1 px-3 pb-3 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`shrink-0 w-14 h-10 rounded border overflow-hidden transition-all ${
                i === activeIndex
                  ? "border-foreground ring-1 ring-foreground"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              <img src={img} alt={ANGLE_LABELS[i]} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TurntableViewer;
