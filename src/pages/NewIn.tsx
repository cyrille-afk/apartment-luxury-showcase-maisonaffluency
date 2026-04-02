import { lazy, Suspense, useState, useCallback, useEffect, useRef } from "react";
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

/* ── Desktop sticky jump nav ── */
function DesktopJumpNav({ designers }: { designers: ReturnType<typeof useNewInDesigners>["data"] }) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!designers || designers.length < 2) return;

    const observers: IntersectionObserver[] = [];
    const visibleSlugs = new Set<string>();

    designers.forEach((d) => {
      const el = document.getElementById(`new-in-${d.slug}`);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            visibleSlugs.add(d.slug);
          } else {
            visibleSlugs.delete(d.slug);
          }
          // Pick the first visible designer in order
          const first = designers.find((dd) => visibleSlugs.has(dd.slug));
          setActiveSlug(first?.slug || null);
        },
        { rootMargin: "-120px 0px -50% 0px", threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [designers]);

  if (!designers || designers.length < 2) return null;

  const handleClick = (slug: string) => {
    setActiveSlug(slug); // Immediately highlight clicked designer
    const el = document.getElementById(`new-in-${slug}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 190;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="sticky top-[140px] z-30 bg-background/90 backdrop-blur-sm border-b border-border/20">
      <div className="max-w-7xl mx-auto px-12 lg:px-20 flex items-center gap-8 py-3">
        <span className="font-body text-[10px] uppercase tracking-[0.35em] text-muted-foreground shrink-0">
          New In
        </span>
        <div className="flex items-center gap-6">
          {designers.map((d) => (
            <button
              key={d.slug}
              onClick={() => handleClick(d.slug)}
              className={cn(
                "font-display text-sm tracking-wide transition-all duration-300 pb-0.5 border-b-2",
                activeSlug === d.slug
                  ? "text-foreground border-foreground"
                  : "text-muted-foreground border-transparent hover:text-foreground/70"
              )}
            >
              {d.display_name || d.name}
            </button>
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

        {/* Desktop: sticky jump nav + stacked editorial sections */}
        <div className="hidden md:block">
          <DesktopJumpNav designers={designers} />
          {designers.map((designer, idx) => (
            <div key={designer.slug} id={`new-in-${designer.slug}`}>
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
