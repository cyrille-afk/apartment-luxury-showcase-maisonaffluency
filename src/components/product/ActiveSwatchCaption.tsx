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
  // Show every swatch whose image_indices include the visible gallery image —
  // dual/triple-axis products (e.g. frame + upholstery) can have the same image
  // tied to multiple finishes; render their names comma-separated and swatches inline.
  const matches = swatches.filter((s) => s.image_indices?.includes(oneBased));
  if (!matches.length) return null;

  return (
    <div className="mt-3 flex flex-col items-center gap-2 px-2 text-center">
      <div className="text-center">
        <div className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Shown in
        </div>
        <div className="font-body text-sm text-foreground">
          {matches.map((m) => m.name).join(", ")}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {matches.map((m) => (
          <div key={m.fabric_id} className="flex items-center">
            {m.image_url ? (
              <img
                src={m.image_url}
                alt={m.name}
                className="w-8 h-8 rounded-full object-cover border border-border"
                loading="lazy"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
