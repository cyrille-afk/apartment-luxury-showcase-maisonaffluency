import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import Index from "./Index";
import { categoryFromSlug, subcategoryFromSlugs } from "@/lib/categorySlugs";

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
    const detail = {
      category,
      subcategory: sub?.subcategory ?? null,
      source: "designers", // matches the existing accepted source on Collectibles/etc.
    };
    // Dispatch on next tick so consumer effects are mounted.
    const id = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("syncCategoryFilter", { detail }));
    }, 0);
    return () => window.clearTimeout(id);
  }, [category, sub?.subcategory]);

  if (!category) return <Navigate to="/" replace />;
  if (subcategorySlug && !sub) return <Navigate to={`/products-category/${categorySlug}`} replace />;

  return <Index />;
};

export default CategoryRoute;
