/**
 * Priced tear sheet shown beneath every completed Axonometric Studio render.
 * Wraps VisualiserTearSheet — the same UI used after Visualiser renders —
 * with axonometric-specific inputs:
 *   - the brief's source/selected product (one row)
 *   - any "preloaded favourite" trade_product ids attached to the brief
 *   - the product currently attached to the AI edit prompt, if any
 *
 * Each input becomes a TearSheetPin keyed to the generic "furniture" surface,
 * so the existing tear sheet component can fetch dimensions / lead time /
 * trade pricing and surface the same per-line + scene-level CTAs.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VisualiserTearSheet, type TearSheetPin } from "@/components/trade/VisualiserTearSheet";

type ProductLike = {
  product_name?: string | null;
  brand_name?: string | null;
  image_url?: string | null;
};

type Props = {
  renderedImage: string | null;
  /** The source/selected product the brief was built from. */
  sourceProduct?: ProductLike | null;
  /** Trade product ids preloaded from the brief (e.g. favourites linked to the request). */
  preloadedFavoriteProductIds?: string[];
  /** Product currently attached to the AI edit prompt, if any. */
  aiAttachedProduct?: ProductLike | null;
};

export function AxonometricTearSheet({
  renderedImage,
  sourceProduct,
  preloadedFavoriteProductIds = [],
  aiAttachedProduct,
}: Props) {
  const [preloaded, setPreloaded] = useState<ProductLike[]>([]);

  useEffect(() => {
    const ids = (preloadedFavoriteProductIds || []).filter(Boolean);
    if (ids.length === 0) {
      setPreloaded([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("product_name, brand_name, image_url")
        .in("id", ids);
      if (cancelled) return;
      setPreloaded((data ?? []) as ProductLike[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [preloadedFavoriteProductIds]);

  // Build pin list, dedup by case-insensitive product name.
  const candidates: ProductLike[] = [
    sourceProduct,
    ...preloaded,
    aiAttachedProduct,
  ].filter(Boolean) as ProductLike[];

  const seen = new Set<string>();
  const pins: TearSheetPin[] = [];
  for (const c of candidates) {
    const name = (c.product_name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pins.push({
      id: `axo-pin-${pins.length}`,
      surface: "furniture",
      productHint: {
        name,
        image_url: c.image_url ?? null,
        brand: c.brand_name ?? null,
      },
    });
  }

  if (pins.length === 0) return null;

  return <VisualiserTearSheet pins={pins} renderedImage={renderedImage} />;
}

export default AxonometricTearSheet;
