import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface PopularProduct {
  product_id: string;
  fav_count: number;
  product_name: string;
  brand_name: string;
  image_url: string | null;
}

export function MostPopularProducts() {
  const [products, setProducts] = useState<PopularProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Get favorite counts grouped by product
      const { data: favs } = await supabase
        .from("trade_favorites")
        .select("product_id");

      if (!favs || favs.length === 0) {
        setLoading(false);
        return;
      }

      // Count favorites per product
      const counts = new Map<string, number>();
      for (const f of favs) {
        counts.set(f.product_id, (counts.get(f.product_id) || 0) + 1);
      }

      // Get top 5 product IDs
      const top5 = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (top5.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch product details
      const { data: prods } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url")
        .in("id", top5.map(([id]) => id));

      const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));
      const result: PopularProduct[] = [];
      for (const [pid, count] of top5) {
        const p = prodMap.get(pid);
        if (p) {
          result.push({
            product_id: pid,
            fav_count: count,
            product_name: p.product_name,
            brand_name: p.brand_name,
            image_url: p.image_url,
          });
        }
      }
      setProducts(result);
      setLoading(false);
    };
    fetch();
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
        <Heart className="h-4 w-4 text-destructive" />
        Most Popular
      </h2>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <Skeleton className="aspect-square" />
              <div className="p-2 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {products.map((p, i) => (
            <Link
              key={p.product_id}
              to={`/trade/showroom?tab=grid&highlight=${p.product_id}`}
              className="group border border-border rounded-lg overflow-hidden hover:border-foreground/20 hover:shadow-sm transition-all"
            >
              <div className="relative aspect-square bg-muted overflow-hidden">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.product_name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Heart className="w-6 h-6 text-muted-foreground/20" />
                  </div>
                )}
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background/80 backdrop-blur-sm font-body text-[10px] text-foreground border border-border">
                  <Heart className="h-2.5 w-2.5 fill-destructive text-destructive" />
                  {p.fav_count}
                </span>
                {i === 0 && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-foreground text-background font-body text-[10px]">
                    #1
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="font-body text-xs text-foreground truncate">{p.product_name}</p>
                <p className="font-body text-[10px] text-muted-foreground truncate">{p.brand_name}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
