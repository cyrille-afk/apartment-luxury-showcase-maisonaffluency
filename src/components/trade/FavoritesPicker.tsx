import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Heart, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FavoriteProduct {
  productId: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  dimensions?: string | null;
  materials?: string | null;
}

interface FavoritesPickerProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxHeight?: string;
}

export default function FavoritesPicker({ selectedIds, onSelectionChange, maxHeight = "max-h-56" }: FavoritesPickerProps) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("trade_favorites")
        .select("product_id, trade_products(product_name, brand_name, image_url, dimensions, materials)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setFavorites(
        (data || []).map((f: any) => ({
          productId: f.product_id,
          product_name: f.trade_products?.product_name || "Unknown",
          brand_name: f.trade_products?.brand_name || "Unknown",
          image_url: f.trade_products?.image_url,
          dimensions: f.trade_products?.dimensions,
          materials: f.trade_products?.materials,
        }))
      );
      setLoading(false);
    };
    fetch();
  }, [user]);

  const toggle = useCallback((productId: string) => {
    onSelectionChange(
      selectedIds.includes(productId)
        ? selectedIds.filter((id) => id !== productId)
        : [...selectedIds, productId]
    );
  }, [selectedIds, onSelectionChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="text-center py-4">
        <Heart className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1.5" />
        <p className="font-body text-[10px] text-muted-foreground">No saved favorites yet</p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto", maxHeight)}>
      {favorites.map((fav) => {
        const selected = selectedIds.includes(fav.productId);
        return (
          <button
            key={fav.productId}
            onClick={() => toggle(fav.productId)}
            className={cn(
              "relative rounded-md border overflow-hidden text-left transition-all",
              selected
                ? "border-[hsl(var(--gold))] ring-1 ring-[hsl(var(--gold))]"
                : "border-border hover:border-foreground/30"
            )}
          >
            <div className="aspect-square bg-muted/30">
              {fav.image_url ? (
                <img src={fav.image_url} alt={fav.product_name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Heart className="w-4 h-4 text-muted-foreground/30" />
                </div>
              )}
            </div>
            {selected && (
              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[hsl(var(--gold))] flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="px-1.5 py-1">
              <p className="font-body text-[9px] text-foreground truncate">{fav.product_name}</p>
              <p className="font-body text-[8px] text-muted-foreground truncate">{fav.brand_name}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
