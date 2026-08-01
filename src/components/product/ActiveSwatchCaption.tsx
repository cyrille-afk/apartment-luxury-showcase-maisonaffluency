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

  const multi = matches.length > 1;

  if (multi) {
    // Several finishes → keep them on a single swipeable line, no "Shown in" label.
    return (
      <div className="mt-3 flex items-center gap-3 overflow-x-auto whitespace-nowrap px-2 no-scrollbar [scrollbar-width:none] justify-start sm:justify-center">
        {matches.map((m) => (
          <span key={m.fabric_id} className="inline-flex shrink-0 items-center gap-1.5">
            {m.image_url ? (
              <img
                src={m.image_url}
                alt={m.name}
                className="w-5 h-5 rounded-full object-cover border border-border"
                loading="lazy"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-muted" />
            )}
            <span className="font-body text-sm text-foreground">{m.name}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-2 text-center">
      <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        Shown in
      </span>
      <span className="font-body text-sm text-foreground inline-flex items-center gap-1">
        {matches[0].image_url ? (
          <img
            src={matches[0].image_url}
            alt={matches[0].name}
            className="w-5 h-5 rounded-full object-cover border border-border"
            loading="lazy"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-muted" />
        )}
        <span>{matches[0].name}</span>
      </span>
    </div>
  );
}
