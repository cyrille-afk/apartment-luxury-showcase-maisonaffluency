/**
 * Shared hook that merges static curator picks with live database picks.
 * All trade product consumers should use this instead of calling
 * getAllTradeProducts() directly — this ensures new database-only
 * designers (e.g. Christopher Boots) appear everywhere.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getAllTradeProducts,
  getAllBrands,
  getAllCategories,
  getSubcategories,
  type TradeProduct,
} from "@/lib/tradeProducts";
import { normalizeCategory, normalizeSubcategory } from "@/lib/productTaxonomy";

async function fetchLiveProducts(): Promise<TradeProduct[]> {
  const { data, error } = await supabase
    .from("designer_curator_picks")
    .select(`
      id,
      title,
      subtitle,
      image_url,
      hover_image_url,
      materials,
      dimensions,
      description,
      edition,
      pdf_url,
      pdf_urls,
      category,
      subcategory,
      tags,
      trade_price_cents,
      currency,
      designers(name)
    `)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, any>>).flatMap((pick) => {
    const designer = Array.isArray(pick.designers)
      ? pick.designers[0]
      : pick.designers;
    const brandName = designer?.name?.trim();
    if (!brandName || !pick.title) return [];

    const rawCategory = pick.category || pick.tags?.[0] || "Uncategorized";
    const rawSubcategory = pick.subcategory || pick.tags?.[1];

    return [
      {
        id: pick.id,
        brand_name: brandName,
        product_name: pick.title,
        subtitle: pick.subtitle ?? undefined,
        category: normalizeCategory(rawCategory, rawSubcategory) || rawCategory,
        subcategory: normalizeSubcategory(rawSubcategory),
        tags: pick.tags || [],
        materials: pick.materials ?? undefined,
        dimensions: pick.dimensions ?? undefined,
        description: pick.description ?? undefined,
        image_url: pick.image_url || null,
        hover_image_url: pick.hover_image_url ?? undefined,
        edition: pick.edition ?? undefined,
        pdf_url: pick.pdf_url ?? undefined,
        pdf_urls: pick.pdf_urls ?? undefined,
      } satisfies TradeProduct,
    ];
  });
}

const keyOf = (p: TradeProduct) =>
  `${p.brand_name.trim().toLowerCase()}::${p.product_name.trim().toLowerCase()}`;

/**
 * Returns merged static + live trade products, brands, and helpers.
 * The query is cached globally so multiple components share the same fetch.
 */
export function useTradeProducts() {
  const staticProducts = useMemo(() => getAllTradeProducts(), []);

  const { data: liveProducts = [] } = useQuery({
    queryKey: ["trade-live-products"],
    queryFn: fetchLiveProducts,
    staleTime: 60_000,
  });

  const allProducts = useMemo(() => {
    const merged = new Map<string, TradeProduct>();
    for (const p of staticProducts) merged.set(keyOf(p), p);
    // Live data wins on collisions
    for (const p of liveProducts) merged.set(keyOf(p), p);
    return Array.from(merged.values());
  }, [staticProducts, liveProducts]);

  const brands = useMemo(() => getAllBrands(allProducts), [allProducts]);
  const categories = useMemo(() => getAllCategories(allProducts), [allProducts]);

  return { allProducts, brands, categories, getSubcategories };
}
