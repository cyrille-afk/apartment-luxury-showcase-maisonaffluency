import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Product3DViewer from "@/components/trade/Product3DViewer";
import { Loader2 } from "lucide-react";

interface Swatch {
  fabric_id: string;
  name: string;
  image_url: string | null;
  supplier: string | null;
  category: string | null;
  sort_order: number | null;
}

interface Props {
  pickId: string;
  title: string;
}

/**
 * Inline drawer that fetches a pick's GLB URL (via trade_products.source_pick_id)
 * and its fabric swatch strip (product_fabric_swatches_public). Rendered lazily
 * from TearsheetProposalCard / QuoteProposalCard when the architect opens the
 * per-row "3D & finishes" section.
 */
export function PickAssetDrawer({ pickId, title }: Props) {
  const [loading, setLoading] = useState(true);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [prodRes, swRes] = await Promise.all([
        supabase
          .from("trade_products")
          .select("glb_url, image_url")
          .eq("source_pick_id", pickId)
          .maybeSingle(),
        supabase
          .from("product_fabric_swatches_public")
          .select("fabric_id, name, image_url, supplier, category, sort_order")
          .eq("pick_id", pickId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true }),
      ]);
      if (cancelled) return;
      if (prodRes.error) setError(prodRes.error.message);
      setGlbUrl((prodRes.data as any)?.glb_url ?? null);
      setPoster((prodRes.data as any)?.image_url ?? null);
      setSwatches(((swRes.data as any[]) ?? []) as Swatch[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickId]);

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-2">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
          Loading 3D &amp; finishes…
        </span>
      </div>
    );
  }

  const hasGlb = !!glbUrl;
  const hasSwatches = swatches.length > 0;

  if (!hasGlb && !hasSwatches) {
    return (
      <div className="mt-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 font-body text-[10px] text-muted-foreground">
        No 3D model or finish swatches on file for this piece.
        {error && <span className="ml-1 text-destructive">({error})</span>}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/40 p-2 space-y-2 animate-fade-in">
      {hasGlb && (
        <div className="max-w-[240px]">
          <Product3DViewer url={glbUrl!} alt={title} poster={poster} />
        </div>
      )}
      {hasSwatches && (
        <div>
          <div className="mb-1 font-display text-[9px] uppercase tracking-widest text-muted-foreground">
            Finishes &amp; fabrics ({swatches.length})
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-none">
            {swatches.map((s) => (
              <div
                key={s.fabric_id}
                className="shrink-0 w-11 flex flex-col items-center gap-0.5"
                title={[s.name, s.supplier, s.category].filter(Boolean).join(" · ")}
              >
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={s.name}
                    loading="lazy"
                    className="h-11 w-11 rounded object-cover bg-muted border border-border/60"
                  />
                ) : (
                  <div className="h-11 w-11 rounded bg-muted border border-border/60" />
                )}
                <span className="w-11 truncate text-center font-body text-[8px] text-muted-foreground leading-tight">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PickAssetDrawer;
