/**
 * Shared hook that merges static curator picks with live database picks.
 * All trade product consumers should use this instead of calling
 * getAllTradeProducts() directly — this ensures new database-only
 * designers (e.g. Christopher Boots) appear everywhere.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveCuratorPickDescription } from "@/lib/curatorPickDescription";
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
import { useHiddenTradeProductIds, getTradeProductHideKey as getHideKey, isTradeProductMarkedHidden } from "@/hooks/useHiddenTradeProductIds";

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
        description: resolveCuratorPickDescription({ description: pick.description }) ?? undefined,
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
  const { ids: hiddenIds } = useHiddenTradeProductIds();

  const { data: liveProducts = [] } = useQuery({
    queryKey: ["trade-live-products"],
    queryFn: fetchLiveProducts,
    staleTime: 60_000,
  });

  const mergedProducts = useMemo(() => {
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
        // Match if the candidate name tokens are a subset of the product name tokens (min 2 tokens),
        // or if a short/static display name is the leading token of the fuller live product name.
        // e.g. "Casque" (static gallery card) → "Casque Bar Cabinet" (live curator pick)
        for (const c of candidates) {
          const cTokens = c.name.split(/\s+/).filter(t => t.length > 2);
          const pTokens = pName.split(/\s+/).filter(t => t.length > 2);
          const isShortDisplayNameMatch =
            pTokens.length === 1 &&
            pTokens[0].length >= 5 &&
            cTokens[0] === pTokens[0];
          if (cTokens.length < 2 && !isShortDisplayNameMatch) continue;
          const allPresent = cTokens.every(t => pName.includes(t));
          if (allPresent || isShortDisplayNameMatch) {
            product.description = c.description;
            break;
          }
        }
      }
    }

    return Array.from(merged.values());
  }, [staticProducts, liveProducts]);

  // Apply dev-only hidden-key filter (used by the duplicate banner so devs
  // can suppress unwanted near-duplicate cards from the live grid).
  const allProducts = useMemo(
    () =>
      hiddenIds.size === 0
        ? mergedProducts
        : mergedProducts.filter((p) => !isTradeProductMarkedHidden(p, hiddenIds)),
    [mergedProducts, hiddenIds]
  );

  const brands = useMemo(() => getAllBrands(allProducts), [allProducts]);
  const categories = useMemo(() => getAllCategories(allProducts), [allProducts]);

  // Dev-only: detect likely duplicate cards (exact key matches collapse via Map,
  // but near-duplicates like "Pars" vs "Pars Cocktail Table" can survive merge).
  // Computed against the *unfiltered* merged set so hidden items remain visible
  // in the banner and can be unhidden.
  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    if (!import.meta.env.DEV) return [];
    const byBrand = new Map<string, TradeProduct[]>();
    for (const p of mergedProducts) {
      const b = p.brand_name.trim().toLowerCase();
      if (!byBrand.has(b)) byBrand.set(b, []);
      byBrand.get(b)!.push(p);
    }
    const groups: DuplicateGroup[] = [];
    for (const [, items] of byBrand) {
      const seen = new Set<number>();
      for (let i = 0; i < items.length; i++) {
        if (seen.has(i)) continue;
        const group = [items[i]];
        const aTokens = items[i].product_name.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        for (let j = i + 1; j < items.length; j++) {
          if (seen.has(j)) continue;
          const bName = items[j].product_name.toLowerCase();
          const bTokens = bName.split(/\s+/).filter(t => t.length > 2);
          const shorter = aTokens.length <= bTokens.length ? aTokens : bTokens;
          const longerName = aTokens.length <= bTokens.length ? bName : items[i].product_name.toLowerCase();
          if (shorter.length === 0) continue;
          const allPresent = shorter.every(t => longerName.includes(t));
          if (allPresent) {
            group.push(items[j]);
            seen.add(j);
          }
        }
        if (group.length > 1) {
          seen.add(i);
          groups.push({
            brand: items[i].brand_name,
            items: group.map(g => ({ id: g.id, hide_key: getHideKey(g), product_name: g.product_name, image_url: g.image_url })),
          });
        }
      }
    }
    return groups;
  }, [mergedProducts]);

  return { allProducts, brands, categories, getSubcategories, duplicateGroups };
}

export interface DuplicateGroup {
  brand: string;
  items: { id: string; hide_key: string; product_name: string; image_url: string | null }[];
}
