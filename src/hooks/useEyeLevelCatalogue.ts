import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TradeProduct } from "@/lib/tradeProducts";
import type { SurfaceProduct } from "../../supabase/functions/_shared/eyeLevelSurfaces";
import { surfaceCatalogueMetadata } from "@/lib/eyeLevelSurfaceCatalogue";

export type EyeLevelCatalogueProduct = TradeProduct & Omit<SurfaceProduct, "product_name">;
export function useEyeLevelCatalogue(products: TradeProduct[], enabled: boolean) {
  const query = useQuery({
    queryKey: ["eye-level-surface-catalogue"], enabled, staleTime: 60_000,
    queryFn: async () => {
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("catalog_items").select("id,name,designer,category_role,width_m,depth_m,height_m")
          .in("category_role", ["rug", "artwork"]).order("id").range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) break;
      }
      const mapped: EyeLevelCatalogueProduct[] = [];
      for (let start = 0; start < rows.length; start += 100) {
        const batch = rows.slice(start, start + 100);
        const { data, error } = await supabase.from("trade_products").select("id,product_name,brand_name,image_url,dimensions,materials,category,subcategory")
          .in("id", batch.map(row => row.id)).eq("is_active", true).or("is_hidden.is.null,is_hidden.eq.false");
        if (error) throw error;
        for (const trade of data) {
          const row = batch.find(item => item.id === trade.id);
          if (!row || !trade.image_url) continue;
          mapped.push({ id: trade.id, trade_product_id: trade.id, product_name: trade.product_name, brand_name: trade.brand_name,
            image_url: trade.image_url, category: row.category_role === "rug" ? "Rugs" : "Artworks", tags: [],
            ...(trade.materials ? { materials: trade.materials } : {}), ...(trade.dimensions ? { dimensions: trade.dimensions } : {}),
            category_role: row.category_role, width_m: row.width_m, depth_m: row.depth_m, height_m: row.height_m });
        }
      }
      // Legacy Trade catalogue surfaces predate spatial catalogue rows; retain their real photos/sizes without writes.
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("trade_products").select("id,product_name,brand_name,image_url,dimensions,materials,category,width_mm,depth_mm,height_mm")
          .in("category", ["Rugs", "Rug", "Artworks", "Artwork", "Wall Art", "Art"]).eq("is_active", true).or("is_hidden.is.null,is_hidden.eq.false").order("id").range(offset, offset + 499);
        if (error) throw error;
        for (const trade of data) {
          if (!trade.image_url || mapped.some(p => p.id === trade.id)) continue;
          mapped.push({ id: trade.id, trade_product_id: trade.id, product_name: trade.product_name, brand_name: trade.brand_name, image_url: trade.image_url, category: trade.category, tags: [],
            ...(trade.materials ? { materials: trade.materials } : {}), ...(trade.dimensions ? { dimensions: trade.dimensions } : {}), ...surfaceCatalogueMetadata(trade) });
        }
        if (data.length < 500) break;
      }
      return mapped;
    },
  });
  const merged = useMemo(() => {
    const surfaces = query.data ?? [];
    const used = new Set<string>();
    const result: EyeLevelCatalogueProduct[] = products.map(product => {
      const surface = surfaces.find(row => row.id === product.trade_product_id || row.id === product.id ||
        (row.product_name.toLowerCase() === product.product_name.toLowerCase() && row.brand_name.toLowerCase() === product.brand_name.toLowerCase()));
      if (surface) { used.add(surface.id); return { ...product, ...surface }; }
      return { ...product, ...surfaceCatalogueMetadata(product) };
    });
    return [...result, ...surfaces.filter(row => !used.has(row.id))];
  }, [products, query.data]);
  return { products: merged, loading: query.isLoading, error: query.error, retry: query.refetch };
}