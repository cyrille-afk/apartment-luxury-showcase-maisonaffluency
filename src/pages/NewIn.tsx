import { lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import NewInSpotlight from "@/components/NewInSpotlight";
import { useNewInDesigners } from "@/hooks/useDesigner";

const Footer = lazy(() => import("@/components/Footer"));

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
        {/* All designers stacked as editorial cards */}
        {designers.map((designer, idx) => (
          <div key={designer.slug}>
            <NewInSpotlight designer={designer} />
            {/* Divider between designers */}
            {idx < designers.length - 1 && (
              <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-4">
                <div className="border-t border-border/30" />
              </div>
            )}
          </div>
        ))}

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
