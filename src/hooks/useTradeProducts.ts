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
import {
  inferSubcategory,
  normalizeCategory,
} from "@/lib/productTaxonomy";
import { normalizeBrandToParent } from "@/lib/brandNormalization";

type LiveTradeProduct = TradeProduct & {
  hasExplicitCategory: boolean;
  hasExplicitSubcategory: boolean;
};

async function fetchLiveProducts(): Promise<LiveTradeProduct[]> {
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
      price_prefix,
      designers(name, founder)
    `)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, any>>).flatMap((pick) => {
    const designer = Array.isArray(pick.designers)
      ? pick.designers[0]
      : pick.designers;
    const childName = designer?.name?.trim();
    if (!childName || !pick.title) return [];
    const founderName = (designer as any)?.founder?.trim();
    const brandName = normalizeBrandToParent(childName);
    const reeditionBy = founderName && founderName.toLowerCase() !== childName.toLowerCase() && founderName.toLowerCase() !== brandName.toLowerCase() ? founderName : undefined;

    const hasExplicitCategory = Boolean(pick.category?.trim?.());
    const hasExplicitSubcategory = Boolean(pick.subcategory?.trim?.());
    const rawCategory = pick.category?.trim() || pick.tags?.[0] || undefined;
    const rawSubcategory = pick.subcategory?.trim() || pick.tags?.[1] || undefined;
    const inferenceText = [pick.title, pick.subtitle].filter(Boolean).join(" ");
    const resolvedSubcategory = inferSubcategory(rawCategory, rawSubcategory, inferenceText);
    const resolvedCategory = normalizeCategory(rawCategory, resolvedSubcategory) || rawCategory || "Uncategorized";

    return [
      {
        id: pick.id,
        brand_name: brandName,
        product_name: pick.title,
        subtitle: pick.subtitle ?? undefined,
        category: resolvedCategory,
        subcategory: resolvedSubcategory,
        tags: pick.tags || [],
        materials: pick.materials ?? undefined,
        dimensions: pick.dimensions ?? undefined,
        description: pick.description ?? undefined,
        image_url: pick.image_url || null,
        hover_image_url: pick.hover_image_url ?? undefined,
        edition: pick.edition ?? undefined,
        pdf_url: pick.pdf_url ?? undefined,
        pdf_urls: pick.pdf_urls ?? undefined,
        price_prefix: pick.price_prefix ?? undefined,
        reedition_by: reeditionBy,
        hasExplicitCategory,
        hasExplicitSubcategory,
      } satisfies LiveTradeProduct,
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
    for (const p of liveProducts) {
      const key = keyOf(p);
      const existing = merged.get(key);
      const { hasExplicitCategory, hasExplicitSubcategory, ...liveProduct } = p;

      if (!existing) {
        merged.set(key, liveProduct);
        continue;
      }

      merged.set(key, {
        ...existing,
        ...liveProduct,
        category: hasExplicitCategory || hasExplicitSubcategory ? liveProduct.category : existing.category,
        subcategory: hasExplicitSubcategory ? liveProduct.subcategory : existing.subcategory,
      });
    }

    // Propagate descriptions from live products to unmatched products via fuzzy name matching
    // e.g. "Corteza Console" (curator) → "Corteza Console Table" (trade_products)
    const descriptionsByBrand = new Map<string, { name: string; description: string }[]>();
    for (const p of liveProducts) {
      if (!p.description) continue;
      const brand = p.brand_name.trim().toLowerCase();
      if (!descriptionsByBrand.has(brand)) descriptionsByBrand.set(brand, []);
      descriptionsByBrand.get(brand)!.push({ name: p.product_name.trim().toLowerCase(), description: p.description });
    }

    if (descriptionsByBrand.size > 0) {
      for (const [, product] of merged) {
        if (product.description) continue;
        const brand = product.brand_name.trim().toLowerCase();
        const candidates = descriptionsByBrand.get(brand);
        if (!candidates) continue;
        const pName = product.product_name.trim().toLowerCase();
        // Match if the candidate name tokens are a subset of the product name tokens (min 2 tokens)
        for (const c of candidates) {
          const cTokens = c.name.split(/\s+/).filter(t => t.length > 2);
          if (cTokens.length < 2) continue;
          const allPresent = cTokens.every(t => pName.includes(t));
          if (allPresent) {
            product.description = c.description;
            break;
          }
        }
      }
    }

    return Array.from(merged.values());
  }, [staticProducts, liveProducts]);

  const brands = useMemo(() => getAllBrands(allProducts), [allProducts]);
  const categories = useMemo(() => getAllCategories(allProducts), [allProducts]);

  return { allProducts, brands, categories, getSubcategories };
}
