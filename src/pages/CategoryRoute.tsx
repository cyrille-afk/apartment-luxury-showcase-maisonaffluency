import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import Index from "./Index";
import CategorySeo from "@/components/seo/CategorySeo";
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

    // 3. Reset scroll immediately so we don't retain prior page's position
    // (e.g. scrolled-to-bottom product page) while waiting for the target.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    // 4. Poll for the scroll target — Suspense chunks may mount late on mobile.
    // Prefer #product-grid (the filtered products section) over #designers
    // (the directory below it), so the user lands on the actual results.
    let cancelled = false;
    const start = performance.now();
    const tryScroll = () => {
      if (cancelled) return;
      const target =
        document.getElementById("product-grid") ||
        document.getElementById("designers") ||
        document.getElementById("featured-designers") ||
        document.querySelector("[data-section='designers']");
      if (target instanceof HTMLElement) {
        // Re-broadcast in case sections mounted after our first dispatch.
        window.dispatchEvent(new CustomEvent("syncCategoryFilter", { detail }));
        // Offset by header (and Featured Read banner) so the hero isn't hidden behind the sticky nav.
        const nav = document.querySelector("nav");
        const headerOffset = nav instanceof HTMLElement ? nav.getBoundingClientRect().height : 96;
        const banner = document.querySelector("[data-featured-read-banner]");
        const bannerOffset = banner instanceof HTMLElement ? banner.getBoundingClientRect().height : 0;
        const top = target.getBoundingClientRect().top + window.scrollY - headerOffset - bannerOffset - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        return;
      }
      if (performance.now() - start < 4000) {
        window.setTimeout(tryScroll, 100);
      }
    };
    window.setTimeout(tryScroll, 50);

    return () => {
      cancelled = true;
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
      <Index />
    </>
  );
};

export default CategoryRoute;
