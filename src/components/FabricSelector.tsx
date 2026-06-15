import { useEffect, useState } from "react";
import { ChevronDown, ZoomIn, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import SpecGlyph from "@/components/product/SpecGlyph";

interface Fabric {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  supplier: string | null;
}

interface FabricSelectorProps {
  /** designer_curator_picks.id — required to look up linked fabrics. */
  pickId: string | null | undefined;
  className?: string;
}

/**
 * Fabric / finish selector accordion shown on upholstered products
 * (Trade + Public). Tiles are grouped by category (Upholstery, Wood, …)
 * with a COM ("Customer's Own Material") tile always offered.
 */
export default function FabricSelector({ pickId, className }: FabricSelectorProps) {
  const [open, setOpen] = useState(false);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<Fabric | null>(null);

  useEffect(() => {
    if (!pickId) {
      setFabrics([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("product_fabrics")
        .select("sort_order, fabric:fabrics(id, name, image_url, category, supplier, is_active)")
        .eq("pick_id", pickId)
        .order("sort_order", { ascending: true });
      if (cancelled || error) return;
      const list: Fabric[] = (data || [])
        .map((row: any) => row.fabric)
        .filter((f: any) => f && f.is_active !== false)
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          image_url: f.image_url,
          category: f.category,
          supplier: f.supplier,
        }));
      setFabrics(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickId]);

  const grouped = fabrics.reduce<Record<string, Fabric[]>>((acc, f) => {
    const key = (f.category || "Fabrics").trim() || "Fabrics";
    (acc[key] ||= []).push(f);
    return acc;
  }, {});
  const groupOrder = ["Upholstery", "Wood", "Leather", "Fabrics"];
  const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
    const ai = groupOrder.indexOf(a);
    const bi = groupOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const comTile: Fabric = {
    id: "__com__",
    name: "COM — Customer's Own Fabric",
    image_url: null,
    category: "COM",
    supplier: null,
  };

  const renderTile = (f: Fabric) => {
    const isCom = f.id === "__com__";
    const isSelected = selectedId === f.id;
    return (
      <div key={f.id} className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setSelectedId(f.id)}
          className={cn(
            "relative aspect-square w-full overflow-hidden rounded-md bg-muted/30 ring-1 ring-border/60 transition",
            isSelected ? "ring-2 ring-foreground" : "hover:ring-foreground/40"
          )}
          aria-label={`Select ${f.name}`}
        >
          {f.image_url ? (
            <img
              src={f.image_url}
              alt={f.name}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-display text-xl tracking-widest text-foreground/85">
              {isCom ? "COM" : "—"}
            </div>
          )}
          {f.image_url && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setZoomed(f);
              }}
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground/70 hover:text-foreground"
              aria-label={`Zoom ${f.name}`}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
        <p className="font-body text-[12px] leading-snug text-foreground/85">
          {f.name}
        </p>
      </div>
    );
  };

  return (
    <div className={cn("border-t border-border/60", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full py-4 flex items-center gap-5 text-left border-b border-border/60"
      >
        <span className="shrink-0">
          <SpecGlyph symbol="⬗" />
        </span>
        <span className="font-body text-sm tracking-wide text-foreground flex-1">
          Select Fabric &amp; Finish
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform shrink-0",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="pb-5 pt-4 space-y-6">
          {sortedGroupKeys.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              {renderTile(comTile)}
            </div>
          ) : (
            <>
              {sortedGroupKeys.map((key) => (
                <div key={key}>
                  <p className="font-body text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-3">
                    {key}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                    {grouped[key].map(renderTile)}
                  </div>
                </div>
              ))}
              <div>
                <p className="font-body text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-3">
                  Customer's Own
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                  {renderTile(comTile)}
                </div>
              </div>
            </>
          )}

          {fabrics.length === 0 && (
            <p className="font-body text-[12px] italic text-muted-foreground">
              Full fabric library coming soon. In the meantime, your atelier
              can be upholstered in COM (Customer's Own Fabric) — please
              request samples or pricing through your Maison Affluency
              concierge.
            </p>
          )}
        </div>
      )}

      {zoomed && zoomed.image_url && (
        <div
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] bg-background/85 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-[480px] w-full"
          >
            <img
              src={zoomed.image_url}
              alt={zoomed.name}
              className="w-full h-auto rounded-md shadow-lg"
            />
            <p className="mt-3 font-body text-sm text-center text-foreground">
              {zoomed.name}
              {zoomed.supplier && (
                <span className="text-muted-foreground"> — {zoomed.supplier}</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
