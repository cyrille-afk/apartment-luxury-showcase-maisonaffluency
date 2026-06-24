import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ExternalLink } from "lucide-react";

interface Fabric {
  id: string;
  name: string;
  category: string | null;
  supplier: string | null;
  image_url: string | null;
  tier: string | null;
  price_per_lm_cents: number | null;
  currency: string | null;
}

interface ProductFabricRow {
  id: string;
  pick_id: string;
  fabric_id: string;
  sort_order: number;
  price_tier_label: string | null;
  image_indices: number[] | null;
  price_cents_a: number | null;
  price_cents_b: number | null;
  fabric: Fabric | null;
}

const EMPTY_PRODUCT_FABRIC_ROWS: ProductFabricRow[] = [];
const EMPTY_FABRICS: Fabric[] = [];

const parseRange = (raw: string): number[] | null => {
  if (!raw || !raw.trim()) return null;
  const out = new Set<number>();
  raw.split(/[,;]/).forEach((part) => {
    const p = part.trim();
    if (!p) return;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let i = lo; i <= hi; i++) if (i > 0) out.add(i);
    } else if (/^\d+$/.test(p)) {
      const n = parseInt(p, 10);
      if (n > 0) out.add(n);
    }
  });
  const arr = Array.from(out).sort((a, b) => a - b);
  return arr.length > 0 ? arr : null;
};

const formatRange = (arr: number[] | null | undefined): string => {
  if (!arr || arr.length === 0) return "";
  const sorted = [...arr].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const n = sorted[i];
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = n;
    prev = n;
  }
  return parts.join(", ");
};

const parsePrice = (raw: string): number | null => {
  const cleaned = raw.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
};

const formatPrice = (cents: number | null | undefined): string =>
  cents && cents > 0 ? (cents / 100).toLocaleString() : "";

const currencySymbol = (c: string | null | undefined) =>
  c === "USD" ? "$" : c === "GBP" ? "£" : "€";

interface Drafts {
  tier: string;
  range: string;
  priceA: string;
  priceB: string;
}

export default function ProductFabricsPanel({
  pickId,
  currency,
}: {
  pickId: string;
  currency?: string | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Drafts>>({});
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const rangeSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Product-level size labels
  const { data: pick } = useQuery({
    queryKey: ["product-fabrics-pick-meta", pickId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("designer_curator_picks")
        .select("fabric_size_label_a, fabric_size_label_b")
        .eq("id", pickId)
        .maybeSingle();
      if (error) throw error;
      return data as { fabric_size_label_a: string | null; fabric_size_label_b: string | null } | null;
    },
  });

  const [labelA, setLabelA] = useState("");
  const [labelB, setLabelB] = useState("");
  useEffect(() => {
    setLabelA(pick?.fabric_size_label_a || "");
    setLabelB(pick?.fabric_size_label_b || "");
  }, [pick?.fabric_size_label_a, pick?.fabric_size_label_b]);

  const saveLabels = async () => {
    const { error } = await (supabase as any)
      .from("designer_curator_picks")
      .update({
        fabric_size_label_a: labelA.trim() || null,
        fabric_size_label_b: labelB.trim() || null,
      })
      .eq("id", pickId);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["product-fabrics-pick-meta", pickId] });
  };

  const { data: rows = EMPTY_PRODUCT_FABRIC_ROWS, isLoading } = useQuery({
    queryKey: ["product-fabrics-panel", pickId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_fabrics")
        .select("*, fabric:fabrics(*)")
        .eq("pick_id", pickId)
        .order("sort_order");
      if (error) throw error;
      return (data as ProductFabricRow[]) || [];
    },
  });

  const { data: allFabrics = EMPTY_FABRICS } = useQuery({
    queryKey: ["all-fabrics-for-panel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrics")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return (data as Fabric[]) || [];
    },
    enabled: adding,
  });

  useEffect(() => {
    const next: Record<string, Drafts> = {};
    rows.forEach((r) => {
      next[r.id] = {
        tier: r.price_tier_label || "",
        range: formatRange(r.image_indices),
        priceA: formatPrice(r.price_cents_a),
        priceB: formatPrice(r.price_cents_b),
      };
    });
    setDrafts(next);
  }, [rows]);

  const linkedIds = useMemo(() => new Set(rows.map((r) => r.fabric_id)), [rows]);
  const filteredFabrics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allFabrics
      .filter((f) => !linkedIds.has(f.id))
      .filter((f) => !q || f.name.toLowerCase().includes(q) || (f.supplier || "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [allFabrics, linkedIds, search]);

  const saveRow = async (rowId: string) => {
    const d = drafts[rowId];
    if (!d) return;
    const { error } = await (supabase as any)
      .from("product_fabrics")
      .update({
        price_tier_label: d.tier.trim() || null,
        image_indices: parseRange(d.range),
        price_cents_a: parsePrice(d.priceA),
        price_cents_b: parsePrice(d.priceB),
      })
      .eq("id", rowId);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["product-fabrics-panel", pickId] });
  };

  const saveImageRange = async (rowId: string, range: string) => {
    const { error } = await supabase
      .from("product_fabrics")
      .update({ image_indices: parseRange(range) })
      .eq("id", rowId);
    if (error) {
      toast({ title: "Image range save failed", description: error.message, variant: "destructive" });
    }
  };

  const queueImageRangeSave = (rowId: string, range: string) => {
    if (rangeSaveTimers.current[rowId]) clearTimeout(rangeSaveTimers.current[rowId]);
    rangeSaveTimers.current[rowId] = setTimeout(() => {
      saveImageRange(rowId, range);
      delete rangeSaveTimers.current[rowId];
    }, 250);
  };

  const linkFabric = async (fabricId: string) => {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const { error } = await supabase
      .from("product_fabrics")
      .insert({ pick_id: pickId, fabric_id: fabricId, sort_order: maxOrder + 1 });
    if (error) {
      toast({ title: "Link failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["product-fabrics-panel", pickId] });
  };

  const unlink = async (rowId: string) => {
    if (!confirm("Remove this fabric from the product?")) return;
    const { error } = await supabase.from("product_fabrics").delete().eq("id", rowId);
    if (error) {
      toast({ title: "Remove failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["product-fabrics-panel", pickId] });
  };

  const sym = currencySymbol(currency);
  const labelsDirty =
    (labelA || "") !== (pick?.fabric_size_label_a || "") ||
    (labelB || "") !== (pick?.fabric_size_label_b || "");

  // Grid: swatch | fabric | tier | priceA | priceB | range | delete
  const gridCols = "grid-cols-[2.25rem_1.4fr_1fr_0.8fr_0.8fr_0.9fr_1.75rem]";

  return (
    <div className="space-y-2 border border-dashed border-border rounded-md p-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          Variants — Fabrics &amp; Finishes
        </label>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setAdding((s) => !s)}>
          {adding ? "Done" : "+ Link fabric"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground italic leading-snug">
        Each row is a variant. Set the two size labels (e.g. <code>6 m</code> / <code>3.5 m</code>), then
        enter the price for each fabric in each size. Leave a price blank if not offered in that size.
        <strong> Image range</strong> = which gallery photos show that fabric (e.g. <code>1-4</code>).
      </p>

      {/* Size labels */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 shrink-0">Sizes:</span>
        <Input
          value={labelA}
          onChange={(e) => setLabelA(e.target.value)}
          onBlur={() => labelsDirty && saveLabels()}
          placeholder="Size A (e.g. 6 m)"
          className="text-xs h-7 max-w-[140px]"
        />
        <Input
          value={labelB}
          onChange={(e) => setLabelB(e.target.value)}
          onBlur={() => labelsDirty && saveLabels()}
          placeholder="Size B (e.g. 3.5 m) — optional"
          className="text-xs h-7 max-w-[180px]"
        />
      </div>

      {isLoading && <p className="text-[10px] text-muted-foreground">Loading…</p>}

      {rows.length === 0 && !isLoading && (
        <p className="text-[10px] text-muted-foreground italic">No fabrics linked yet.</p>
      )}

      {rows.length > 0 && (
        <div className={`grid ${gridCols} gap-1.5 items-center text-[9px] uppercase tracking-wider text-muted-foreground/70 pt-1`}>
          <span></span>
          <span>Finish</span>
          <span>Price tier label</span>
          <span>{sym} {labelA || "Size A"}</span>
          <span>{sym} {labelB || "Size B"}</span>
          <span>Image range</span>
          <span></span>
        </div>
      )}

      {rows.map((r) => {
        const d = drafts[r.id] || { tier: "", range: "", priceA: "", priceB: "" };
        const dirty =
          d.tier !== (r.price_tier_label || "") ||
          d.range !== formatRange(r.image_indices) ||
          d.priceA !== formatPrice(r.price_cents_a) ||
          d.priceB !== formatPrice(r.price_cents_b);
        return (
          <div key={r.id} className={`grid ${gridCols} gap-1.5 items-center`}>
            {r.fabric?.image_url ? (
              <img
                src={r.fabric.image_url}
                alt={r.fabric.name}
                className="w-9 h-9 object-cover rounded border border-border"
              />
            ) : (
              <div className="w-9 h-9 rounded border border-dashed border-border bg-muted" />
            )}
            <div className="text-xs leading-tight min-w-0">
              <div className="font-medium truncate">
                {r.fabric?.supplier ? `${r.fabric.supplier} — ${r.fabric.name}` : (r.fabric?.name || "—")}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {r.fabric?.category}
                {r.fabric?.tier ? ` · CAT ${r.fabric.tier}` : ""}
                {r.fabric?.price_per_lm_cents
                  ? ` · ${(r.fabric.price_per_lm_cents / 100).toLocaleString()}${sym}/LM`
                  : ""}
              </div>
            </div>
            <Input
              value={d.tier}
              onChange={(e) => setDrafts((s) => ({ ...s, [r.id]: { ...d, tier: e.target.value } }))}
              onBlur={() => dirty && saveRow(r.id)}
              placeholder="e.g. ECART (own)"
              className="text-xs h-8"
            />
            <Input
              value={d.priceA}
              onChange={(e) => setDrafts((s) => ({ ...s, [r.id]: { ...d, priceA: e.target.value } }))}
              onBlur={() => dirty && saveRow(r.id)}
              placeholder="—"
              inputMode="decimal"
              className="text-xs h-8 text-right"
            />
            <Input
              value={d.priceB}
              onChange={(e) => setDrafts((s) => ({ ...s, [r.id]: { ...d, priceB: e.target.value } }))}
              onBlur={() => dirty && saveRow(r.id)}
              placeholder="—"
              inputMode="decimal"
              className="text-xs h-8 text-right"
            />
            <Input
              value={d.range}
              onChange={(e) => {
                const nextRange = e.target.value;
                setDrafts((s) => ({ ...s, [r.id]: { ...d, range: nextRange } }));
                queueImageRangeSave(r.id, nextRange);
              }}
              onBlur={() => dirty && saveRow(r.id)}
              placeholder="1-4"
              className="text-xs h-8"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive shrink-0"
              onClick={() => unlink(r.id)}
              title="Unlink fabric"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}

      {adding && (
        <div className="mt-2 border-t border-border pt-2 space-y-1.5">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fabrics by name or supplier…"
            className="text-xs h-8"
          />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredFabrics.map((f) => (
              <button
                key={f.id}
                onClick={() => linkFabric(f.id)}
                className="w-full flex items-center gap-2 px-1.5 py-1 hover:bg-muted rounded text-left"
              >
                {f.image_url ? (
                  <img src={f.image_url} alt={f.name} className="w-7 h-7 object-cover rounded border border-border" />
                ) : (
                  <div className="w-7 h-7 rounded border border-dashed border-border bg-muted" />
                )}
                <div className="text-xs leading-tight flex-1 min-w-0">
                  <div className="truncate">{f.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {f.category}
                    {f.tier ? ` · CAT ${f.tier}` : ""}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </button>
            ))}
            {filteredFabrics.length === 0 && (
              <p className="text-[10px] text-muted-foreground italic px-1.5">No matching fabrics.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
