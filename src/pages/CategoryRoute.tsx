import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import DesignersDirectory from "@/components/DesignersDirectory";
import CategorySeo from "@/components/seo/CategorySeo";
import GalleryDetailsFloatingNav from "@/components/GalleryDetailsFloatingNav";
import { categoryFromSlug, subcategoryFromSlugs } from "@/lib/categorySlugs";
import {
  setPendingCategoryFilter,
  clearPendingCategoryFilter,
} from "@/lib/pendingCategoryFilter";

/**
 * /products-category/:categorySlug/:subcategorySlug?
 * Renders the homepage and broadcasts the category filter so the
 * Collectibles / FeaturedDesigners / BrandsAteliers sections apply it.
 */
const CategoryRoute = () => {
  const { categorySlug, subcategorySlug } = useParams();

  const category = categoryFromSlug(categorySlug);
  const sub = subcategorySlug ? subcategoryFromSlugs(categorySlug, subcategorySlug) : null;

  // Broadcast on every mount/param change so all listening sections sync.
  useEffect(() => {
    if (!category) return;
    const subcategory = sub?.subcategory ?? null;

    // 1. Persist the filter so late-mounting (lazy) sections can read it.
    setPendingCategoryFilter({ category, subcategory });

    // 2. Broadcast immediately for sections already mounted.
    const detail = { category, subcategory, source: "url" };
    window.dispatchEvent(new CustomEvent("syncCategoryFilter", { detail }));

    // 3. Reset scroll immediately so category pages start from their own header.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    // 4. Re-broadcast shortly after mount for the directory component.
    const syncTimer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("syncCategoryFilter", { detail }));
    }, 150);

    return () => {
      window.clearTimeout(syncTimer);
      // Clear once we leave the route so other pages aren't affected.
      clearPendingCategoryFilter();
    };
  }, [category, sub?.subcategory]);

  if (!category) return <Navigate to="/" replace />;
  if (subcategorySlug && !sub) return <Navigate to={`/products-category/${categorySlug}`} replace />;

  return (
    <>
      <CategorySeo
        category={category}
        subcategory={sub?.subcategory ?? null}
        categorySlug={categorySlug!}
        subcategorySlug={subcategorySlug ?? null}
      />
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <main id="main-content" className="min-h-screen overflow-x-hidden pt-[var(--header-h)]">
          <section id="designers" className="scroll-header-offset">
            <DesignersDirectory mode="products" showTradeCTA={false} />
          </section>
          <Footer />
        </main>
        <GalleryDetailsFloatingNav showImmediately azHref="/designers" />
      </div>
    </>
  );
};

export default CategoryRoute;
