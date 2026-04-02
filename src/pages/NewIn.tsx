import { lazy, Suspense, useState, useCallback, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import useEmblaCarousel from "embla-carousel-react";
import Navigation from "@/components/Navigation";
import NewInSpotlight from "@/components/NewInSpotlight";
import { useNewInDesigners } from "@/hooks/useDesigner";
import { cn } from "@/lib/utils";

const Footer = lazy(() => import("@/components/Footer"));

/* ── Mobile carousel with dot indicators ── */
function MobileDesignerCarousel({ designers }: { designers: ReturnType<typeof useNewInDesigners>["data"] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
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

  if (!designers || designers.length === 0) return null;

  return (
    <div>
      {/* Dot indicators */}
      {designers.length > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          {designers.map((d, i) => (
            <button
              key={d.slug}
              onClick={() => emblaApi?.scrollTo(i)}
              className="flex items-center gap-1.5 group"
              aria-label={`Go to ${d.display_name || d.name}`}
            >
              <span
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === selectedIndex
                    ? "w-6 bg-foreground"
                    : "w-1.5 bg-foreground/25 group-hover:bg-foreground/40"
                )}
              />
            </button>
          ))}
        </div>
      )}

      {/* Designer name label */}
      <div className="px-6 pb-3">
        <p className="font-body text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
          New In — {designers[selectedIndex]?.display_name || designers[selectedIndex]?.name}
        </p>
      </div>

      {/* Carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {designers.map((designer) => (
            <div key={designer.slug} className="flex-[0_0_100%] min-w-0">
              <NewInSpotlight designer={designer} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
const NewIn = () => {
  const { data: designers = [], isLoading } = useNewInDesigners();

  const firstDesigner = designers[0];

  const pageTitle = firstDesigner
    ? `New In — ${firstDesigner.display_name || firstDesigner.name} | Maison Affluency`
    : "New In | Maison Affluency";

  const pageDescription = firstDesigner
    ? `Discover ${firstDesigner.display_name || firstDesigner.name} — explore their curated collection at Maison Affluency.`
    : "Discover new designers and curated collections at Maison Affluency.";

  const ogImage = firstDesigner?.hero_image_url || firstDesigner?.image_url || "";

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta property="og:url" content="https://www.maisonaffluency.com/new-in" />
        <meta property="og:type" content="article" />
      </Helmet>

      <Navigation />

      <div className="mt-[96px]">
        {/* Mobile: swipeable carousel with dots */}
        <div className="md:hidden">
          <MobileDesignerCarousel designers={designers} />
        </div>

        {/* Desktop: stacked editorial sections */}
        <div className="hidden md:block">
          {designers.map((designer, idx) => (
            <div key={designer.slug}>
              <NewInSpotlight designer={designer} />
              {idx < designers.length - 1 && (
                <div className="max-w-7xl mx-auto px-12 lg:px-20 py-6">
                  <div className="border-t border-border/30" />
                </div>
              )}
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 text-center">
            <p className="font-body text-sm text-muted-foreground">Loading…</p>
          </div>
        )}

        {!isLoading && designers.length === 0 && (
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 text-center">
            <p className="font-body text-sm text-muted-foreground">No new designers at the moment. Check back soon.</p>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="border-t border-border/40" />
      </div>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
};

export default NewIn;
