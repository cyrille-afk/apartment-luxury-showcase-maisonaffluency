import { lazy, Suspense, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import NewInSpotlight from "@/components/NewInSpotlight";
import { useNewInDesigners } from "@/hooks/useDesigner";
import { cn } from "@/lib/utils";

const Footer = lazy(() => import("@/components/Footer"));

const NewIn = () => {
  const { data: designers = [], isLoading } = useNewInDesigners();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // Sync active designer from URL or default to first
  useEffect(() => {
    if (designers.length === 0) return;
    const urlSlug = searchParams.get("designer");
    const match = urlSlug && designers.find((d) => d.slug === urlSlug);
    if (match) {
      setActiveSlug(match.slug);
    } else if (!activeSlug || !designers.find((d) => d.slug === activeSlug)) {
      setActiveSlug(designers[0].slug);
    }
  }, [designers, searchParams]);

  const activeDesigner = designers.find((d) => d.slug === activeSlug) ?? designers[0];

  const handleTabClick = (slug: string) => {
    setActiveSlug(slug);
    setSearchParams({ designer: slug }, { replace: true });
  };

  const pageTitle = activeDesigner
    ? `New In — ${activeDesigner.display_name || activeDesigner.name} | Maison Affluency`
    : "New In | Maison Affluency";

  const pageDescription = activeDesigner
    ? `Discover ${activeDesigner.display_name || activeDesigner.name} — explore their curated collection at Maison Affluency.`
    : "Discover new designers and curated collections at Maison Affluency.";

  const ogImage = activeDesigner?.hero_image_url || activeDesigner?.image_url || "";

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
        {/* Designer tabs — only show when more than 1 designer */}
        {designers.length > 1 && (
          <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 pt-6 pb-0">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              {designers.map((d) => {
                const isActive = d.slug === activeSlug;
                const name = d.display_name || d.name;
                return (
                  <button
                    key={d.slug}
                    onClick={() => handleTabClick(d.slug)}
                    className={cn(
                      "shrink-0 px-5 py-2 rounded-full border text-xs font-body uppercase tracking-[0.18em] transition-all duration-300",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/20 bg-transparent text-foreground/60 hover:border-foreground/40 hover:text-foreground"
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active designer spotlight */}
        {activeDesigner && <NewInSpotlight key={activeDesigner.slug} designer={activeDesigner} />}

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
