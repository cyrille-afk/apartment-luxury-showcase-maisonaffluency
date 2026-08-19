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
    align: "start",
    containScroll: false,
    slidesToScroll: 1,
    dragFree: false,
    duration: 20,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});

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

  const handleImageLoad = useCallback(
    (slideId: string, e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
        setAspectRatios((prev) => ({
          ...prev,
          [slideId]: img.naturalWidth / img.naturalHeight,
        }));
      }
    },
    []
  );

  const slideWidth = useCallback(
    (slide: HeritageSlide) => {
      const ratio = aspectRatios[slide.id];
      if (!ratio) return "flex-[0_0_80%] md:flex-[0_0_45%]";
      if (ratio >= 1.3) return "flex-[0_0_88%] md:flex-[0_0_58%]";
      if (ratio <= 0.75) return "flex-[0_0_56%] md:flex-[0_0_34%]";
      return "flex-[0_0_72%] md:flex-[0_0_44%]";
    },
    [aspectRatios]
  );

  if (slides.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
      className="mt-4 md:mt-6 mb-10 md:mb-14"
    >
      <h3 className="font-display text-xs tracking-[0.2em] uppercase text-muted-foreground mb-5">
        Archives
      </h3>

      <div className="relative group h-auto">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex items-end">
            {slides.map((slide) => (
              <figure
                key={slide.id}
                className={`${slideWidth(slide)} min-w-0 px-2 md:px-3 flex flex-col`}
              >
                <div className="overflow-hidden bg-muted/10 flex-1 flex items-end">
                  <img
                    src={slide.image_url}
                    alt={slide.caption || "Heritage piece"}
                    className="w-full h-auto object-contain"
                    loading="lazy"
                    onLoad={(e) => handleImageLoad(slide.id, e)}
                  />
                </div>
                {slide.caption && (
                  <figcaption className="mt-2.5 md:mt-3 text-[11px] text-muted-foreground/80 font-body leading-snug text-left whitespace-pre-line">
                    {slide.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-background transition-all opacity-0 group-hover:opacity-100 z-10"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => emblaApi?.scrollNext()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-background transition-all opacity-0 group-hover:opacity-100 z-10"
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
        variant="archive"
        size="xs"
        className="mt-8 gap-3"
        ariaPrefix="Go to slide"
      />
    </motion.section>
  );
};

export default HeritageSlider;
