import { lazy, Suspense, useState } from "react";
import { Helmet } from "react-helmet-async";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navigation from "@/components/Navigation";
import NewInSpotlight from "@/components/NewInSpotlight";
import { useNewInDesigners } from "@/hooks/useDesigner";
import { cn } from "@/lib/utils";

const Footer = lazy(() => import("@/components/Footer"));

const NewIn = () => {
  const { data: designers = [], isLoading } = useNewInDesigners();
  // First designer open by default
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set());

  const toggleDesigner = (slug: string) => {
    setOpenSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  // Auto-open the first designer once data loads
  const firstSlug = designers[0]?.slug;
  if (firstSlug && openSlugs.size === 0 && !openSlugs.has(firstSlug)) {
    setOpenSlugs(new Set([firstSlug]));
  }

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
        {designers.map((designer) => {
          const isOpen = openSlugs.has(designer.slug);
          const displayName = designer.display_name || designer.name;
          return (
            <div key={designer.slug} className="border-b border-border/30">
              {/* Collapsible trigger */}
              <button
                type="button"
                onClick={() => toggleDesigner(designer.slug)}
                className="w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-6 md:py-8 flex items-center justify-between group text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="font-body text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                    New In
                  </span>
                  <h2 className="font-display text-xl md:text-2xl lg:text-[1.75rem] text-foreground tracking-[0.12em] uppercase">
                    {displayName}
                  </h2>
                </div>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-foreground/60 transition-transform duration-300 shrink-0",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              {/* Collapsible content */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key={`content-${designer.slug}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <NewInSpotlight designer={designer} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

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
