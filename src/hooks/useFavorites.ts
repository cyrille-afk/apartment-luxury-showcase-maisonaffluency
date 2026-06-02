import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ensureTradeProductId, type ProductMeta } from "@/lib/ensureTradeProduct";

export const TRADE_FAVORITES_EVENT = "trade_favorites_changed";

/**
 * Hook to manage product favorites.
 * Provides favorited product IDs and toggle function.
 *
 * For gallery products with local IDs (tp-0, tp-1…), pass ProductMeta
 * to toggleFavorite so a real trade_products record is ensured first.
 * A localIdMap tracks the mapping from local ID → real UUID.
 *
 * Multiple components calling useFavorites stay in sync via the
 * `trade_favorites_changed` window event, dispatched after any mutation
 * (including those made by the folder picker).
 */
export function useFavorites() {
  const { user } = useAuth();
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [localIdMap, setLocalIdMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    const fetch = async () => {
      const { data } = await supabase
        .from("trade_favorites")
        .select("product_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      setFavoritedIds(new Set((data || []).map((d: any) => d.product_id)));
      setLoading(false);
    };
    fetch();
    const onSync = () => { fetch(); };
    window.addEventListener(TRADE_FAVORITES_EVENT, onSync);
    return () => {
      cancelled = true;
      window.removeEventListener(TRADE_FAVORITES_EVENT, onSync);
    };
  }, [user]);

  /**
   * Toggle a favorite. Returns the real UUID if added, or null if removed.
   *
   * @param productId - can be a real UUID or a local ID like "tp-0"
   * @param meta - required for local IDs so a trade_products record can be created
   */
  const toggleFavorite = useCallback(async (
    productId: string,
    meta?: ProductMeta,
  ): Promise<string | null> => {
    if (!user) return null;

    let realId = productId;

    if (meta) {
      const cached = localIdMap.get(productId);
      if (cached) {
        realId = cached;
      } else {
        const resolved = await ensureTradeProductId(meta);
        if (!resolved) return null;
        realId = resolved;
        setLocalIdMap((prev) => new Map(prev).set(productId, realId));
      }
    }

    const isFav = favoritedIds.has(realId);

    if (isFav) {
      setFavoritedIds((prev) => { const next = new Set(prev); next.delete(realId); return next; });
      await supabase.from("trade_favorites").delete().eq("user_id", user.id).eq("product_id", realId);
      window.dispatchEvent(new Event(TRADE_FAVORITES_EVENT));
      return null;
    } else {
      setFavoritedIds((prev) => new Set(prev).add(realId));
      await supabase.from("trade_favorites").insert({ user_id: user.id, product_id: realId });
      window.dispatchEvent(new Event(TRADE_FAVORITES_EVENT));
      return realId;
    }
  }, [user, favoritedIds, localIdMap]);

  const isFavorited = useCallback((productId: string) => {
    if (favoritedIds.has(productId)) return true;
    const mapped = localIdMap.get(productId);
    return mapped ? favoritedIds.has(mapped) : false;
  }, [favoritedIds, localIdMap]);

  return { isFavorited, toggleFavorite, favoritedIds, loading };
}
