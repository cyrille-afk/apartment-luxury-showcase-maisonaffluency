import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import SliderDots from "@/components/ui/SliderDots";
import type { HeritageSlide } from "@/hooks/useHeritageSlides";

interface HeritageSliderProps {
  slides: HeritageSlide[];
}

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

const HeritageSlider = ({ slides }: HeritageSliderProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    containScroll: false,
    slidesToScroll: 1,
    dragFree: false,
    duration: 20,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (slides.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
      className="my-10 md:my-14"
    >
      <h3 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-5">
        Archives
      </h3>

      <div className="relative group">
        <div className="overflow-hidden rounded-xl" ref={emblaRef}>
          <div className="flex">
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="flex-[0_0_80%] md:flex-[0_0_45%] min-w-0 px-2"
              >
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted/10 relative">
                  <img
                    src={slide.image_url}
                    alt={slide.caption || "Heritage piece"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {slide.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-10 pb-3 px-4">
                      <p className="font-body text-[9px] md:text-[10px] tracking-wide text-white/80 italic text-center leading-relaxed whitespace-pre-line">
                        {slide.caption}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-background transition-all opacity-0 group-hover:opacity-100 z-10"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => emblaApi?.scrollNext()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-background transition-all opacity-0 group-hover:opacity-100 z-10"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      <SliderDots
        count={slides.length}
        activeIndex={selectedIndex}
        onSelect={(i) => emblaApi?.scrollTo(i)}
        variant="dark"
        className="mt-4"
        ariaPrefix="Go to slide"
      />

    </motion.section>
  );
};

export default HeritageSlider;
