import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to manage product favorites.
 * Provides favorited product IDs and toggle function for use in showroom/grid views.
 */
export function useFavorites() {
  const { user } = useAuth();
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from("trade_favorites")
        .select("product_id")
        .eq("user_id", user.id);
      setFavoritedIds(new Set((data || []).map((d: any) => d.product_id)));
      setLoading(false);
    };
    fetch();
  }, [user]);

  const toggleFavorite = useCallback(async (productId: string): Promise<boolean> => {
    if (!user) return false;
    const isFav = favoritedIds.has(productId);

    if (isFav) {
      // Remove
      setFavoritedIds((prev) => { const next = new Set(prev); next.delete(productId); return next; });
      await supabase.from("trade_favorites").delete().eq("user_id", user.id).eq("product_id", productId);
      return false;
    } else {
      // Add
      setFavoritedIds((prev) => new Set(prev).add(productId));
      await supabase.from("trade_favorites").insert({ user_id: user.id, product_id: productId });
      return true;
    }
  }, [user, favoritedIds]);

  const isFavorited = useCallback((productId: string) => favoritedIds.has(productId), [favoritedIds]);

  return { isFavorited, toggleFavorite, favoritedIds, loading };
}
