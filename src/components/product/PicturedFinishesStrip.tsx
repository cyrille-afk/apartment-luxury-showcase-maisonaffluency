import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { finishPhotoIndex, picturedFinishesForImage } from "@/lib/picturedFinishes";
import { Button } from "@/components/ui/button";

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
  biekeLayout = false,
  onSelectImage,
  imageCount = 0,
  available = false,
  fallbackNames = [],
}: {
  pickId: string;
  activeIndex: number | undefined;
  baseLabel?: string | null;
  topLabel?: string | null;
  biekeLayout?: boolean;
  onSelectImage?: (index: number) => void;
  imageCount?: number;
  available?: boolean;
  fallbackNames?: string[];
}) {
  const [swatches, setSwatches] = useState<Swatch[]>([]);

  useEffect(() => {
    let cancelled = false;
    setSwatches([]);
    (async () => {
      const { data, error } = await (supabase as any)
        .from("product_fabric_swatches_public")
        .select("fabric_id, name, image_url, image_indices, category, is_active")
        .eq("pick_id", pickId);
      if (cancelled || error) return;
      setSwatches(
        (data || []).filter(
          (r: any) => r && r.is_active !== false && (available || (Array.isArray(r.image_indices) && r.image_indices.length)),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [pickId, available]);

  const shown = available
    ? swatches
    : picturedFinishesForImage(swatches, activeIndex, biekeLayout);
  if (!shown.length && !(available && fallbackNames.length)) return null;
  const base = shown.filter((s) => FRAME_RE.test(s.name) || (
    (s.category || "").toLowerCase() === "wood" && !/drawer|wood pillars?/i.test(topLabel || "")
  ));
  const top = shown.filter((s) => !base.includes(s));
  // Some older photos overlap a broad colourway group and an exact single-photo
  // swatch. The exact match is the same one the selector displays.
  const firstMatch = (items: Swatch[]) => items.length
    ? [items.reduce((best, item) => item.image_indices.length < best.image_indices.length ? item : best)]
    : [];
  const groups = biekeLayout && !available
    ? topLabel && baseLabel && baseLabel.toLowerCase() !== "size"
      ? [{ label: /^(shelf finish)$/i.test(baseLabel) ? "Frame" : baseLabel, items: firstMatch(base) }, { label: topLabel, items: firstMatch(top) }]
      : [{ label: topLabel && topLabel.toLowerCase() !== "size" ? topLabel : "Finish", items: shown }]
    : shown.map((s) => ({
        label: /^(fabric|leather|upholstery|fabric & leather)$/i.test(s.category || "") ? "Upholstery"
          : /^(rug|rug finish)$/i.test(s.category || "") ? "Rug Finish"
          : /^(cover|rattan|cane|wicker)$/i.test(s.category || "") ? "Cover"
          : s.category && !/^(other)$/i.test(s.category) ? `${s.category} Finish` : "Finish",
        items: [s],
      }));

  const Item = ({ label, s }: { label: string; s: Swatch }) => {
    const content = (
    <span className="inline-flex items-center gap-1.5">
      {s.image_url ? (
        <img src={s.image_url} alt={s.name} className={available ? "h-9 w-9 shrink-0 rounded-none border border-border object-cover" : "h-3.5 w-3.5 shrink-0 rounded-full border border-border object-cover"} loading="lazy" />
      ) : (
        <span className="h-3.5 w-3.5 rounded-full bg-muted" />
      )}
      {!available && <span className="font-light text-muted-foreground">{label}:</span>}
      <span className="font-medium text-foreground">{s.name}</span>
    </span>
    );
    const index = finishPhotoIndex(s, swatches, imageCount);
    if (!onSelectImage || index === undefined) return content;
    return (
      <Button
        type="button"
        variant="ghost"
        aria-label={`Show ${s.name} product photo`}
        aria-pressed={s.image_indices.includes((activeIndex ?? 0) + 1)}
        title={`Show ${s.name} product photo`}
        className="h-auto whitespace-normal rounded-none px-1 py-1 text-left text-[11px]"
        onClick={() => onSelectImage(index)}
      >
        {content}
      </Button>
    );
  };

  if (available) {
    const sections = new Map<string, Swatch[]>();
    for (const s of shown) {
      const c = s.category || "";
      const label = (s.category || "").toLowerCase() === "wood" ? "Frame"
        : /fabric|leather|upholstery/i.test(c) ? "Upholstery"
        : c && !/^other$/i.test(c) ? c : "Finish";
      sections.set(label, [...(sections.get(label) || []), s]);
    }
    return (
      <div className="mt-4 space-y-5 font-body text-[11px]">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Finishes available</span>
        {[...sections].map(([label, items]) => (
          <div key={label} className="space-y-2">
            {sections.size > 1 && <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {items.map((s) => <Item key={s.fabric_id} label={label} s={s} />)}
            </div>
          </div>
        ))}
        {!shown.length && fallbackNames.map((name) => <span key={name} className="block text-foreground">{name}</span>)}
      </div>
    );
  }

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
