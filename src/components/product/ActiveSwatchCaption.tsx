import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Swatch = {
  fabric_id: string;
  name: string;
  image_url: string | null;
  image_indices: number[] | null;
};

/**
 * Small caption rendered directly under the product image gallery.
 *
 * When the currently-visible gallery image falls within the `image_indices`
 * range of one of the linked product swatches (wood / stone / raku / fabric
 * etc.), we render that swatch's thumbnail + name so the viewer immediately
 * understands which finish they are looking at.
 *
 * Stays silent when there is no match (e.g. editorial photos that aren't
 * tied to any swatch).
 */
export default function ActiveSwatchCaption({
  pickId,
  activeIndex,
}: {
  pickId: string | null | undefined;
  activeIndex: number | undefined;
}) {
  const [swatches, setSwatches] = useState<Swatch[]>([]);

  useEffect(() => {
    if (!pickId) {
      setSwatches([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("product_fabric_swatches_public")
        .select("fabric_id, name, image_url, image_indices, is_active")
        .eq("pick_id", pickId);
      if (cancelled || error) return;
      setSwatches(
        (data || [])
          .filter((r: any) => r && r.is_active !== false && Array.isArray(r.image_indices) && r.image_indices.length)
          .map((r: any) => ({
            fabric_id: r.fabric_id,
            name: r.name,
            image_url: r.image_url,
            image_indices: r.image_indices,
          })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [pickId]);

  if (!swatches.length || activeIndex === undefined || activeIndex === null) return null;
  const oneBased = activeIndex + 1;
  const match = swatches.find((s) => s.image_indices?.includes(oneBased));
  if (!match) return null;

  return (
    <div className="mt-3 flex items-center justify-center gap-3 px-1 text-center">
      {match.image_url ? (
        <img
          src={match.image_url}
          alt={match.name}
          className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
      )}
      <div>
        <div className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Shown in
        </div>
        <div className="font-body text-sm text-foreground">{match.name}</div>
      </div>
    </div>
  );
}
