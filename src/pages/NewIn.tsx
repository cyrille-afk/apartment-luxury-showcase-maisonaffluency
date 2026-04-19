import { lazy, Suspense, useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ShareMenu from "@/components/ShareMenu";
import { Helmet } from "react-helmet-async";
import useEmblaCarousel from "embla-carousel-react";
import Navigation from "@/components/Navigation";
import NewInSpotlight from "@/components/NewInSpotlight";
import { useNewInDesigners } from "@/hooks/useDesigner";
import { cn } from "@/lib/utils";

const Footer = lazy(() => import("@/components/Footer"));

/* ── Mobile carousel with dot indicators ── */
function MobileDesignerCarousel({ designers, initialIndex = 0 }: { designers: ReturnType<typeof useNewInDesigners>["data"]; initialIndex?: number }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start", startIndex: initialIndex });
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);
  const slidesRef = useRef<(HTMLDivElement | null)[]>([]);

  const syncHeight = useCallback(() => {
    const el = slidesRef.current[selectedIndex];
    if (el) setContainerHeight(el.scrollHeight);
  }, [selectedIndex]);

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

  // Sync height whenever selected slide changes or content loads
  useLayoutEffect(() => {
    syncHeight();
    // Also observe resize of the active slide
    const el = slidesRef.current[selectedIndex];
    if (!el) return;
    const ro = new ResizeObserver(() => syncHeight());
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedIndex, syncHeight, designers]);

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
              className="flex items-center"
              aria-label={`Go to ${d.display_name || d.name}`}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition-all duration-300",
                  i === selectedIndex
                    ? "w-6 bg-foreground"
                    : "bg-muted-foreground/35 hover:bg-muted-foreground/55"
                )}
              />
            </button>
          ))}
        </div>
      )}

      {/* Designer name label + share */}
      <div className="px-6 pb-3 flex items-center justify-between">
        <p className="font-body text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
          New In — {designers[selectedIndex]?.display_name || designers[selectedIndex]?.name}
        </p>
        <ShareMenu
          url="https://www.maisonaffluency.com/new-in-og.html"
          message="Maison Affluency · New In — Discover our latest designers: https://www.maisonaffluency.com/new-in-og.html"
          className="flex items-center p-1 -m-1 text-foreground/40 hover:text-foreground transition-colors"
          iconSize="w-4 h-4"
          showLabel={false}
        />
      </div>

      {/* Carousel */}
      <div
        className="overflow-hidden transition-[height] duration-300 ease-out"
        ref={emblaRef}
        style={containerHeight ? { height: containerHeight } : undefined}
      >
        <div className="flex items-start">
          {designers.map((designer, i) => (
            <div
              key={designer.slug}
              className="flex-[0_0_100%] min-w-0"
              ref={(el) => { slidesRef.current[i] = el; }}
            >
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
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

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
          // Only update from observer when not in a programmatic scroll
          if (!isScrollingRef.current) {
            const first = designers.find((dd) => visibleSlugs.has(dd.slug));
            setActiveSlug(first?.slug || null);
          }
        },
        { rootMargin: "-200px 0px -40% 0px", threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [designers]);

  if (!designers || designers.length < 2) return null;

  const handleClick = (slug: string) => {
    // Suppress observer updates during smooth scroll
    isScrollingRef.current = true;
    clearTimeout(scrollTimeoutRef.current);
    setActiveSlug(slug);

    const el = document.getElementById(`new-in-${slug}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 190;
      window.scrollTo({ top: y, behavior: "smooth" });
    }

    // Re-enable observer after scroll settles
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 1000);
  };

  return (
    <div className="sticky top-[140px] z-30 bg-background/90 backdrop-blur-sm border-b border-border/20">
      <div className="max-w-7xl mx-auto px-12 lg:px-20 flex items-center gap-8 py-3">
        <div className="flex items-center gap-3 shrink-0">
          <ShareMenu
            url="https://www.maisonaffluency.com/new-in-og.html"
            message="Maison Affluency · New In — Discover Pierre Bonnefille, Christopher Boots, Pierre Yovanovitch, Achille Salvagni & Pierre Augustin Rose: https://www.maisonaffluency.com/new-in-og.html"
            className="flex items-center p-1 -m-1 text-foreground/50 hover:text-foreground transition-colors"
            iconSize="w-5 h-5"
            showLabel={false}
          />
          <span className="font-body text-xs uppercase tracking-[0.2em] font-bold text-foreground bg-muted px-3 py-1 rounded-full">
            New In
          </span>
        </div>
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
  const [searchParams] = useSearchParams();
  const returnDesigner = searchParams.get("designer");

  // Find the index of the designer to return to
  const returnIndex = returnDesigner
    ? Math.max(0, designers.findIndex((d) => d.slug === returnDesigner))
    : 0;

  // For desktop: scroll to the designer section on mount
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (!returnDesigner || designers.length === 0 || scrolledRef.current) {
      if (!returnDesigner) window.scrollTo(0, 0);
      return;
    }
    scrolledRef.current = true;
    const el = document.getElementById(`new-in-${returnDesigner}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: "auto" });
    }
  }, [returnDesigner, designers]);

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
          <MobileDesignerCarousel designers={designers} initialIndex={returnIndex} />
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
