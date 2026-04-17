import React, { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageGalleryProps {
  images: string[];
  alt: string;
  overlay?: React.ReactNode;
}

const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({ images, alt, overlay }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const goTo = useCallback((i: number) => {
    setActiveIndex(Math.max(0, Math.min(i, images.length - 1)));
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div className="flex gap-4">
      {/* Vertical thumbnails */}
      {images.length > 1 && (
        <div className="hidden md:flex flex-col gap-2 w-20 shrink-0">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                "aspect-square rounded-md overflow-hidden border-2 transition-all",
                i === activeIndex
                  ? "border-foreground"
                  : "border-border hover:border-foreground/30"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Main image with arrows */}
      <div className="flex-1 relative group">
        <div className="aspect-square bg-muted/10 rounded-lg overflow-hidden flex items-center justify-center relative">
          <img
            src={images[activeIndex]}
            alt={alt}
            className="w-full h-full object-contain"
            style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
          />
        </div>
        {overlay && (
          <div className="absolute -top-6 left-6 z-20 max-w-[70%]">
            {overlay}
          </div>
        )}

        {/* Prev / Next arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center transition-opacity",
                activeIndex === 0 ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <ChevronLeft size={18} className="text-foreground" />
            </button>
            <button
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex === images.length - 1}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center transition-opacity",
                activeIndex === images.length - 1 ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <ChevronRight size={18} className="text-foreground" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === activeIndex ? "bg-foreground scale-110" : "bg-foreground/30 hover:bg-foreground/50"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductImageGallery;
