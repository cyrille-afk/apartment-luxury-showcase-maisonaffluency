import { useState, useEffect, useMemo } from "react";
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
  fabric: Fabric | null;
}

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

export default function ProductFabricsPanel({ pickId }: { pickId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { tier: string; range: string }>>({});
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["product-fabrics-panel", pickId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_fabrics")
        .select("*, fabric:fabrics(*)")
        .eq("pick_id", pickId)
        .order("sort_order");
      if (error) throw error;
      return (data as unknown as ProductFabricRow[]) || [];
    },
  });

  const { data: allFabrics = [] } = useQuery({
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

  // Sync drafts when rows load
  useEffect(() => {
    const next: Record<string, { tier: string; range: string }> = {};
    rows.forEach((r) => {
      next[r.id] = {
        tier: r.price_tier_label || "",
        range: formatRange(r.image_indices),
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
    const { error } = await supabase
      .from("product_fabrics")
      .update({
        price_tier_label: d.tier.trim() || null,
        image_indices: parseRange(d.range),
      })
      .eq("id", rowId);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
    qc.invalidateQueries({ queryKey: ["product-fabrics-panel", pickId] });
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

  return (
    <div className="space-y-2 border border-dashed border-border rounded-md p-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          Fabrics &amp; Finishes
        </label>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setAdding((s) => !s)}>
          {adding ? "Done" : "+ Link fabric"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground italic leading-snug">
        Each fabric/finish swatch shown on this product. <strong>Price tier</strong> = label shown to clients
        (e.g. "ECART fabric (6 m)"). <strong>Image range</strong> = which gallery photos depict it (e.g. <code>1-4</code> or <code>1,2,5</code>).
      </p>

      {isLoading && <p className="text-[10px] text-muted-foreground">Loading…</p>}

      {rows.length === 0 && !isLoading && (
        <p className="text-[10px] text-muted-foreground italic">No fabrics linked yet.</p>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-[2.25rem_1fr_1fr_1fr_1.75rem] gap-1.5 items-center text-[9px] uppercase tracking-wider text-muted-foreground/70">
          <span></span>
          <span>Fabric</span>
          <span>Price tier</span>
          <span>Image range</span>
          <span></span>
        </div>
      )}

      {rows.map((r) => {
        const d = drafts[r.id] || { tier: "", range: "" };
        const dirty =
          d.tier !== (r.price_tier_label || "") ||
          d.range !== formatRange(r.image_indices);
        return (
          <div key={r.id} className="grid grid-cols-[2.25rem_1fr_1fr_1fr_1.75rem] gap-1.5 items-center">
            {r.fabric?.image_url ? (
              <img
                src={r.fabric.image_url}
                alt={r.fabric.name}
                className="w-9 h-9 object-cover rounded border border-border"
              />
            ) : (
              <div className="w-9 h-9 rounded border border-dashed border-border bg-muted" />
            )}
            <div className="text-xs leading-tight">
              <div className="font-medium truncate">{r.fabric?.name || "—"}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {r.fabric?.category}
                {r.fabric?.tier ? ` · CAT ${r.fabric.tier}` : ""}
                {r.fabric?.price_per_lm_cents
                  ? ` · ${(r.fabric.price_per_lm_cents / 100).toLocaleString()}${r.fabric.currency === "EUR" ? "€" : ""}/LM`
                  : ""}
              </div>
            </div>
            <Input
              value={d.tier}
              onChange={(e) => setDrafts((s) => ({ ...s, [r.id]: { ...d, tier: e.target.value } }))}
              onBlur={() => dirty && saveRow(r.id)}
              placeholder='e.g. ECART fabric (6 m)'
              className="text-xs h-8"
            />
            <Input
              value={d.range}
              onChange={(e) => setDrafts((s) => ({ ...s, [r.id]: { ...d, range: e.target.value } }))}
              onBlur={() => dirty && saveRow(r.id)}
              placeholder="e.g. 1-4 or 1,2,5"
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
