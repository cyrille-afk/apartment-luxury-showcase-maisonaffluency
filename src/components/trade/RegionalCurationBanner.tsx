import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRegionalLogistics } from "@/hooks/useRegionalLogistics";

interface Drop {
  id: string;
  title: string;
  description: string | null;
  featured_products: string[];
  hero_image_url: string | null;
  target_region: string;
}

interface DropProduct {
  id: string;
  product_name: string;
  image_url: string | null;
}

export function RegionalCurationBanner() {
  const { regionTier, loading: regionLoading } = useRegionalLogistics();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [products, setProducts] = useState<Record<string, DropProduct>>({});

  useEffect(() => {
    if (regionLoading) return;
    let cancelled = false;
    const run = async () => {
      const { data } = await supabase
        .from("curated_drops")
        .select("id, title, description, featured_products, hero_image_url, target_region")
        .eq("is_active", true)
        .in("target_region", [regionTier, "GLOBAL"])
        .order("sort_order", { ascending: true })
        .limit(3);
      if (cancelled) return;
      const list = (data || []) as Drop[];
      setDrops(list);

      const ids = Array.from(new Set(list.flatMap((d) => d.featured_products || []))).slice(0, 12);
      if (ids.length) {
        const { data: prods } = await supabase
          .from("trade_products")
          .select("id, product_name, image_url")
          .in("id", ids);
        if (!cancelled) {
          setProducts(Object.fromEntries(((prods || []) as DropProduct[]).map((p) => [p.id, p])));
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [regionTier, regionLoading]);

  if (!drops.length) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-body text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Exclusive Regional Curation · {regionTier}
        </h2>
      </div>

      <div className="space-y-5">
        {drops.map((drop) => {
          const items = (drop.featured_products || [])
            .map((id) => products[id])
            .filter(Boolean)
            .slice(0, 4);
          return (
            <article key={drop.id} className="border border-border rounded-sm overflow-hidden">
              {drop.hero_image_url && (
                <img
                  src={drop.hero_image_url}
                  alt={drop.title}
                  loading="lazy"
                  className="w-full h-40 sm:h-56 object-cover"
                />
              )}
              <div className="p-5">
                <h3 className="font-display text-xl">{drop.title}</h3>
                {drop.description && (
                  <p className="font-body text-sm text-muted-foreground mt-2 max-w-2xl">{drop.description}</p>
                )}
                {items.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {items.map((p) => (
                      <Link
                        key={p.id}
                        to={`/trade/products/${p.id}`}
                        className="group block"
                      >
                        <div className="aspect-square bg-muted overflow-hidden rounded-sm">
                          {p.image_url && (
                            <img
                              src={p.image_url}
                              alt={p.product_name}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          )}
                        </div>
                        <p className="font-body text-[11px] mt-2 line-clamp-2">{p.product_name}</p>
                      </Link>
                    ))}
                  </div>
                )}
                <Link
                  to="/trade/designers"
                  className="inline-flex items-center gap-1.5 font-body text-xs uppercase tracking-[0.18em] mt-5 hover:opacity-70 transition-opacity"
                >
                  Explore the curation <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default RegionalCurationBanner;
