import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Swatch = {
  fabric_id: string;
  name: string;
  image_url: string | null;
  image_indices: number[] | null;
};

type CaptionVariant = "dark" | "light";

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
  variant = "dark",
  selectedNames,
}: {
  pickId: string | null | undefined;
  activeIndex: number | undefined;
  variant?: CaptionVariant;
  /**
   * Names of the finishes the user has actively selected (upholstery, base,
   * top). When provided, the caption reflects the user's selection rather
   * than only the per-image `image_indices` mapping — dual-axis products
   * (e.g. fabric + wood) photograph each fabric against ONE wood variant,
   * so index matching alone would drop the chosen fabric caption whenever a
   * different wood is selected.
   */
  selectedNames?: Array<string | null | undefined>;
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
  // Shared slides (brand logo, editorial closing frame) are mapped to every
  // finish so they still appear at the end of each filtered set — they are not
  // finish-specific, so never caption them.
  if (swatches.length > 1 && matches.length === swatches.length) return null;

  // When the user has actively selected finishes, caption the SELECTION —
  // resolves thumbnails by name from the swatch list; names without a swatch
  // row still render (text only).
  const chosen = (selectedNames || [])
    .map((n) => (n || "").trim())
    .filter(Boolean);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const captionSwatches: Swatch[] = chosen.length
    ? chosen.map((name) => {
        const hit =
          swatches.find((s) => norm(s.name) === norm(name)) ||
          swatches.find((s) => norm(s.name).includes(norm(name)) || norm(name).includes(norm(s.name)));
        return hit ?? { fabric_id: `sel-${name}`, name, image_url: null, image_indices: null };
      })
    : matches;

  const multi = captionSwatches.length > 1;
  const isLight = variant === "light";

  if (multi) {
    // Several finishes → keep them on a single swipeable line, no "Shown in" label.
    return (
      <div className={cn(
        "mt-3 flex items-center gap-3 overflow-x-auto whitespace-nowrap px-2 no-scrollbar [scrollbar-width:none] justify-start sm:justify-center",
        isLight && "text-white/90"
      )}>
        {captionSwatches.map((m) => (
          <span key={m.fabric_id} className="inline-flex shrink-0 items-center gap-1.5">
            {m.image_url ? (
              <img
                src={m.image_url}
                alt={m.name}
                className={cn(
                  "w-5 h-5 rounded-full object-cover border",
                  isLight ? "border-white/30" : "border-border"
                )}
                loading="lazy"
              />
            ) : (
              <div className={cn("w-5 h-5 rounded-full", isLight ? "bg-white/20" : "bg-muted")} />
            )}
            <span className={cn("font-body text-sm", isLight ? "text-white" : "text-foreground")}>
              {m.name}
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-2 text-center">
      <span className={cn(
        "font-body text-[10px] uppercase tracking-[0.15em]",
        isLight ? "text-white/70" : "text-muted-foreground"
      )}>
        Shown in
      </span>
      <span className={cn(
        "font-body text-sm inline-flex items-center gap-1",
        isLight ? "text-white" : "text-foreground"
      )}>
        {matches[0].image_url ? (
          <img
            src={matches[0].image_url}
            alt={matches[0].name}
            className={cn(
              "w-5 h-5 rounded-full object-cover border",
              isLight ? "border-white/30" : "border-border"
            )}
            loading="lazy"
          />
        ) : (
          <div className={cn("w-5 h-5 rounded-full", isLight ? "bg-white/20" : "bg-muted")} />
        )}
        <span>{matches[0].name}</span>
      </span>
    </div>
  );
}
