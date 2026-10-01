import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Swatch = { fabric_id: string; name: string; image_url: string | null; image_indices: number[]; category: string | null };

const FRAME_RE = /^(cement stuc|glossy lacquer)\b/i;

/**
 * Names only the finishes mapped to the visible photo. Keep each product's
 * Base/Top labels, rather than assuming every piece has a drawer.
 */
export default function PicturedFinishesStrip({
  pickId,
  activeIndex,
  baseLabel = "Frame",
  topLabel = "Drawer",
}: {
  pickId: string;
  activeIndex: number | undefined;
  baseLabel?: string | null;
  topLabel?: string | null;
}) {
  const [swatches, setSwatches] = useState<Swatch[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("product_fabric_swatches_public")
        .select("fabric_id, name, image_url, image_indices, category, is_active")
        .eq("pick_id", pickId);
      if (cancelled || error) return;
      setSwatches(
        (data || []).filter(
          (r: any) => r && r.is_active !== false && Array.isArray(r.image_indices) && r.image_indices.length,
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [pickId]);

  const oneBased = (activeIndex ?? 0) + 1;
  const shown = swatches.filter((s) => s.image_indices.includes(oneBased));
  if (!shown.length) return null;
  const base = shown.filter((s) => FRAME_RE.test(s.name) || (
    (s.category || "").toLowerCase() === "wood" && !/drawer|wood pillars?/i.test(topLabel || "")
  ));
  const top = shown.filter((s) => !base.includes(s));
  const groups = topLabel && baseLabel && baseLabel.toLowerCase() !== "size"
    ? [{ label: baseLabel, items: base }, { label: topLabel, items: top }]
    : [{ label: topLabel && topLabel.toLowerCase() !== "size" ? topLabel : "Finish", items: shown }];

  const Item = ({ label, s }: { label: string; s: Swatch }) => (
    <span className="inline-flex items-center gap-1.5">
      {s.image_url ? (
        <img src={s.image_url} alt={s.name} className="h-3.5 w-3.5 rounded-full border border-border object-cover" loading="lazy" />
      ) : (
        <span className="h-3.5 w-3.5 rounded-full bg-muted" />
      )}
      <span className="font-light text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{s.name}</span>
    </span>
  );

  return (
    <div
      aria-live="polite"
      className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border border-border/50 bg-muted/30 px-4 py-3 font-body text-[11px]"
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pictured Finishes</span>
      {groups.flatMap((group) => group.items.map((s) => <Item key={s.fabric_id} label={group.label} s={s} />))}
    </div>
  );
}
