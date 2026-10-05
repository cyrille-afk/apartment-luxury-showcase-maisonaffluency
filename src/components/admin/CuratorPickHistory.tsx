import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RotateCcw } from "lucide-react";

type Version = {
  audit_id: string;
  pick_id: string;
  operation: string;
  created_at: string;
  snapshot: Record<string, any>;
};

const IGNORED = new Set(["sort_order", "embedding", "embedding_source_hash", "embedded_at"]);
const LABELS: Record<string, string> = {
  image_url: "main photo", hover_image_url: "hover photo", gallery_images: "photos",
  size_variants: "finishes/sizes", trade_price_cents: "price", description: "description",
  materials: "materials", title: "title", subtitle: "subtitle", pdf_urls: "PDFs",
};

function changedFields(a: Record<string, any>, b?: Record<string, any>): string[] {
  if (!b) return [];
  return Object.keys(a).filter((k) => !IGNORED.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

function summary(s: Record<string, any>) {
  const imgs = (s.gallery_images?.length ?? 0) + (s.image_url ? 1 : 0);
  const fin = Array.isArray(s.size_variants) ? s.size_variants.length : 0;
  const price = s.trade_price_cents ? `${s.currency || "EUR"} ${(s.trade_price_cents / 100).toLocaleString()}` : "no price";
  return `${imgs} photo${imgs === 1 ? "" : "s"} · ${fin} finish option${fin === 1 ? "" : "s"} · ${price}`;
}

/** Version list for a single product; auto-saves are grouped into editing sessions (2-minute gaps). */
export function CuratorPickHistoryDialog({ pickId, open, onOpenChange, onRestored }: {
  pickId: string | null; open: boolean; onOpenChange: (o: boolean) => void; onRestored: () => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Version[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pickId) return;
    setRows(null);
    (supabase.rpc as any)("list_curator_pick_versions", { _pick_id: pickId }).then(({ data, error }: any) => {
      if (error) toast({ title: "Couldn't load history", description: error.message, variant: "destructive" });
      setRows((data as Version[]) || []);
    });
  }, [open, pickId, toast]);

  const grouped = useMemo(() => {
    if (!rows) return [];
    const out: (Version & { fields: string[] })[] = [];
    // rows are newest first; keep the newest row of each burst of auto-saves
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const prevKept = out[out.length - 1];
      if (prevKept && prevKept.operation === "UPDATE" && r.operation === "UPDATE" &&
          new Date(prevKept.created_at).getTime() - new Date(r.created_at).getTime() < 120_000) {
        continue;
      }
      out.push({ ...r, fields: [] });
    }
    for (let i = 0; i < out.length; i++) {
      out[i].fields = changedFields(out[i].snapshot, out[i + 1]?.snapshot);
    }
    return out;
  }, [rows]);

  const restore = async (v: Version) => {
    if (!window.confirm(`Restore this product to the version from ${new Date(v.created_at).toLocaleString()}?`)) return;
    setBusy(v.audit_id);
    const { error } = await (supabase.rpc as any)("restore_curator_pick_version", { _audit_id: v.audit_id });
    setBusy(null);
    if (error) { toast({ title: "Restore failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Version restored" });
    onRestored();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-serif">Version history</DialogTitle></DialogHeader>
        {!rows ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : grouped.length === 0 ? (
          <p className="text-xs text-muted-foreground">No saved versions yet.</p>
        ) : (
          <ul className="space-y-2">
            {grouped.map((v, i) => (
              <li key={v.audit_id} className="border border-border rounded p-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium">
                    {new Date(v.created_at).toLocaleString()} {i === 0 && v.operation !== "DELETE" && <span className="text-muted-foreground">(current)</span>}
                    {v.operation === "DELETE" && <span className="text-destructive"> (state when deleted)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{summary(v.snapshot)}</p>
                  {v.fields.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">Changed: {v.fields.map((f) => LABELS[f] || f.replace(/_/g, " ")).join(", ")}</p>
                  )}
                </div>
                {!(i === 0 && v.operation !== "DELETE") && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" disabled={!!busy} onClick={() => restore(v)}>
                    {busy === v.audit_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RotateCcw className="w-3 h-3 mr-1" />Restore</>}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Deleted products for a designer, restorable to their last state. */
export function DeletedPicksDialog({ designerId, open, onOpenChange, onRestored }: {
  designerId: string; open: boolean; onOpenChange: (o: boolean) => void; onRestored: () => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Version[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(null);
    (async () => {
      const { data, error } = await (supabase.rpc as any)("list_curator_pick_versions", { _designer_id: designerId });
      if (error) { toast({ title: "Couldn't load deleted products", description: error.message, variant: "destructive" }); setRows([]); return; }
      const del = ((data as Version[]) || []);
      const ids = [...new Set(del.map((d) => d.pick_id))];
      const { data: live } = ids.length
        ? await supabase.from("designer_curator_picks").select("id").in("id", ids)
        : { data: [] as any[] };
      const liveIds = new Set((live || []).map((l: any) => l.id));
      const seen = new Set<string>();
      setRows(del.filter((d) => !liveIds.has(d.pick_id) && !seen.has(d.pick_id) && seen.add(d.pick_id)));
    })();
  }, [open, designerId, toast]);

  const restore = async (v: Version) => {
    setBusy(v.audit_id);
    const { error } = await (supabase.rpc as any)("restore_curator_pick_version", { _audit_id: v.audit_id });
    setBusy(null);
    if (error) { toast({ title: "Restore failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `"${v.snapshot.title}" restored` });
    setRows((r) => (r || []).filter((x) => x.audit_id !== v.audit_id));
    onRestored();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-serif">Deleted products</DialogTitle></DialogHeader>
        {!rows ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No deleted products for this designer.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((v) => (
              <li key={v.audit_id} className="border border-border rounded p-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{v.snapshot.title || "Untitled"}</p>
                  <p className="text-[11px] text-muted-foreground">Deleted {new Date(v.created_at).toLocaleString()} · {summary(v.snapshot)}</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" disabled={!!busy} onClick={() => restore(v)}>
                  {busy === v.audit_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RotateCcw className="w-3 h-3 mr-1" />Restore</>}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
