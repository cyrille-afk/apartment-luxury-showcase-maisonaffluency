import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { brandMatches, variantKey } from "@/lib/swatchBrandMatch";

export type VariantRow = {
  label?: string;
  base?: string;
  top?: string;
  price_cents: number;
};

export type Swatch = {
  id: string;
  name: string;
  brand_name: string | null;
  category: string | null;
  material_type: string | null;
  finish: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  designerName?: string;
  currentVariants: VariantRow[];
  currentBaseAxisLabel: string | null;
  onApply: (merged: VariantRow[], baseAxisLabel: string | null) => void;
}

const DEFAULT_CATEGORIES = new Set(["Metal", "Stone"]);
const TRUNCATED_LABELS = new Set(["", "base", "finish", "rod fini", "fini"]);

export default function SwatchSyncDialog({
  open, onOpenChange, designerName, currentVariants, currentBaseAxisLabel, onApply,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(DEFAULT_CATEGORIES);
  const [keepOrphans, setKeepOrphans] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("material_swatches")
      .select("id,name,brand_name,category,material_type,finish")
      .eq("is_active", true)
      .limit(1000)
      .then(({ data, error }) => {
        if (error) {
          console.error("[SwatchSync] load failed", error);
          setSwatches([]);
        } else {
          const matched = (data || []).filter((s) => brandMatches(designerName, s.brand_name));
          setSwatches(matched as Swatch[]);
        }
        setLoading(false);
      });
  }, [open, designerName]);

  const allCats = useMemo(
    () => Array.from(new Set(swatches.map((s) => s.category || "Other"))).sort(),
    [swatches],
  );

  const filtered = useMemo(
    () => swatches.filter((s) => selectedCats.has(s.category || "Other")),
    [swatches, selectedCats],
  );

  const merged = useMemo(() => {
    const tops = uniq(currentVariants.map((v) => (v.top || "").trim()).filter(Boolean));
    const sizes = uniq(currentVariants.map((v) => (v.label || "").trim()).filter(Boolean));
    const newBases = uniq(filtered.map((s) => s.name.trim()).filter(Boolean));
    const topAxis = tops.length ? tops : [""];
    const sizeAxis = sizes.length ? sizes : [""];

    const priceMap = new Map<string, { price_cents: number; row: VariantRow }>();
    currentVariants.forEach((v) => {
      priceMap.set(variantKey(v.base, v.top, v.label), { price_cents: v.price_cents || 0, row: v });
    });

    const out: VariantRow[] = [];
    for (const b of newBases) {
      for (const t of topAxis) {
        for (const l of sizeAxis) {
          const found = priceMap.get(variantKey(b, t, l));
          out.push({
            base: b,
            top: t || undefined,
            label: l || undefined,
            price_cents: found?.price_cents || 0,
          });
        }
      }
    }

    if (keepOrphans) {
      const newBasesNorm = new Set(newBases.map((b) => b.toLowerCase()));
      for (const v of currentVariants) {
        if (v.base && !newBasesNorm.has(v.base.trim().toLowerCase())) out.push(v);
      }
    }
    return out;
  }, [filtered, currentVariants, keepOrphans]);

  const added = merged.length - currentVariants.length;
  const preserved = merged.filter((m) => (m.price_cents || 0) > 0).length;

  const handleApply = () => {
    let nextLabel = currentBaseAxisLabel;
    const trimmedLabel = (currentBaseAxisLabel || "").trim().toLowerCase();
    if (TRUNCATED_LABELS.has(trimmedLabel)) {
      const mt = filtered[0]?.material_type;
      nextLabel = mt ? `${mt} Finish` : "Finish";
    }
    onApply(merged, nextLabel);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sync Base axis from Fabrics &amp; Finishes</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading swatches…
          </div>
        ) : swatches.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">
            No swatches found for <strong>{designerName || "this designer"}</strong>. Add them in{" "}
            <a href="/trade/admin/fabrics" className="underline" target="_blank" rel="noreferrer">
              Trade Admin → Fabrics &amp; Finishes
            </a>{" "}
            first (set the same brand name), then re-open this dialog.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                Categories ({swatches.length} swatch{swatches.length === 1 ? "" : "es"} matched)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allCats.map((c) => {
                  const on = selectedCats.has(c);
                  return (
                    <Badge
                      key={c}
                      variant={on ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedCats((prev) => {
                          const n = new Set(prev);
                          if (on) n.delete(c); else n.add(c);
                          return n;
                        });
                      }}
                    >
                      {c} ({swatches.filter((s) => (s.category || "Other") === c).length})
                    </Badge>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={keepOrphans}
                onChange={(e) => setKeepOrphans(e.target.checked)}
              />
              Keep existing custom Base rows not in the swatch library
            </label>

            <div className="border rounded-md p-3 space-y-1 max-h-64 overflow-auto text-xs">
              <div className="flex justify-between font-medium text-muted-foreground mb-1">
                <span>Preview: {merged.length} rows</span>
                <span>{preserved} prices preserved · {added >= 0 ? `+${added}` : added} vs current</span>
              </div>
              {filtered.map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-0.5">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">— {s.category}{s.material_type ? ` · ${s.material_type}` : ""}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-muted-foreground">No swatches in selected categories.</div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleApply}
            disabled={loading || filtered.length === 0}
          >
            Apply ({merged.length} rows)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function uniq<T>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const a of arr) {
    const k = String(a).toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(a); }
  }
  return out;
}
