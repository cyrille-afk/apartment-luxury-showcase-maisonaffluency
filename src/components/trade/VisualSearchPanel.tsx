import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import { cn } from "@/lib/utils";
import type { TradeProduct } from "@/lib/tradeProducts";

type Phase = "idle" | "loading" | "results";

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

/** Visual Search: drop-zone + simulated match feedback (mock matching for now). */
export default function VisualSearchPanel() {
  const { user } = useAuth();
  const { currentStudio, canEdit } = useStudio();
  const { projects } = useProjects({ activeOnly: true });
  const { allProducts } = useTradeProducts();
  const { showTradePrice, discountPct } = useTradePriceMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<TradeProduct | null>(null);
  const [saving, setSaving] = useState(false);

  // Mock curation: up to 4 Alexander Lamont pieces with imagery.
  const matches = useMemo(() => {
    const withImg = allProducts.filter((p) => p.image_url);
    const al = withImg.filter((p) => /alexander lamont/i.test(p.brand_name));
    return [...al, ...withImg].filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i).slice(0, 4);
  }, [allProducts]);

  const ids = matches.map((m) => m.id);
  const { data: prices } = useQuery({
    queryKey: ["visual-search-prices", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("designer_curator_picks")
        .select("id, trade_price_cents, currency").in("id", ids);
      return new Map((data ?? []).map((r) => [r.id, r]));
    },
  });

  const priceLabel = (p: TradeProduct) => {
    const row = prices?.get(p.id);
    const cents = Number(row?.trade_price_cents) || 0;
    if (!cents) return "Price upon Request";
    const cur = row?.currency || "EUR";
    return showTradePrice ? fmt(Math.round(cents * (1 - discountPct / 100)), cur) : fmt(cents, cur);
  };

  const handleFile = useCallback((file?: File | null) => {
    if (!file || !file.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
    setPhase("loading");
    window.setTimeout(() => setPhase("results"), 1400);
  }, []);

  const reset = () => { if (preview) URL.revokeObjectURL(preview); setPreview(null); setPhase("idle"); };

  const stage = async (project: Project) => {
    if (!selected || !user || saving || !canEdit) return;
    setSaving(true);
    try {
      let productId = selected.trade_product_id ?? null;
      if (!productId) {
        const { data } = await supabase.from("trade_products").select("id").eq("source_pick_id", selected.id).limit(1).maybeSingle();
        productId = data?.id ?? null;
      }
      if (!productId) throw new Error("This piece cannot be staged until it is in the trade catalogue.");
      const { data: board } = await supabase.from("client_boards").select("id")
        .eq("project_id", project.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      let boardId = board?.id;
      if (!boardId) {
        const created = await supabase.from("client_boards").insert({
          user_id: user.id, studio_id: currentStudio?.id ?? null, project_id: project.id,
          title: `${project.name} — Selection`, client_name: project.client_name || "",
        } as never).select("id").single();
        if (created.error || !created.data) throw created.error || new Error("Could not create a project folder.");
        boardId = created.data.id;
      }
      const { data: dup } = await supabase.from("client_board_items").select("id")
        .eq("board_id", boardId).eq("product_id", productId).limit(1).maybeSingle();
      if (!dup) {
        const { error } = await supabase.from("client_board_items").insert({ board_id: boardId, product_id: productId } as never);
        if (error) throw error;
      }
      toast.success(`${selected.product_name} added to ${project.name}`);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not stage this piece.");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-8">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
        className={cn(
          "relative flex w-full flex-col items-center justify-center border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center transition-colors md:py-20",
          dragging && "border-foreground/50 bg-muted/40",
        )}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
        {phase === "loading" ? (
          <div className="flex flex-col items-center gap-5" role="status" aria-live="polite">
            <div className="relative size-16">
              <span className="absolute inset-0 animate-ping rounded-full bg-muted-foreground/15" />
              <span className="absolute inset-2 animate-pulse rounded-full bg-muted-foreground/20" />
            </div>
            <p className="font-body text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Cross-referencing the catalogue…</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-4">
            <img src={preview} alt="Uploaded reference" className="max-h-40 w-auto object-contain" />
            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="rounded-none font-body text-[10px] uppercase tracking-[0.25em]" onClick={() => inputRef.current?.click()}>Replace Image</Button>
              <Button variant="ghost" size="sm" className="rounded-none font-body text-[10px] uppercase tracking-[0.25em]" onClick={reset}><X className="mr-1 size-3" />Clear</Button>
            </div>
          </div>
        ) : (
          <>
            <Camera className="mb-5 size-8 stroke-[1.1] text-muted-foreground" aria-hidden="true" />
            <h2 className="font-body text-xs uppercase tracking-[0.35em] text-foreground">Drag &amp; Drop Image Reveal</h2>
            <p className="mt-3 max-w-xl font-display text-base font-light leading-relaxed text-muted-foreground">
              Upload an inspirational photo, material texture finish, or rendering layout to instantly cross-reference our luxury artisan catalogue tables.
            </p>
            <Button variant="outline" size="sm" className="mt-6 rounded-none border-border/80 bg-transparent px-6 font-body text-[10px] uppercase tracking-[0.3em]" onClick={() => inputRef.current?.click()}>
              Browse Files
            </Button>
          </>
        )}
      </div>

      <div className={cn("grid transition-all duration-500 ease-out", phase === "results" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <p className="mb-4 font-body text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Curated Matches</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {matches.map((p) => (
              <div key={p.id} className="bg-card p-3">
                <div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-background">
                  <img src={optimizeImageUrl(p.image_url!, "w_500,c_limit,q_auto,f_auto")} alt={p.product_name} loading="lazy" className="h-full w-full object-contain" />
                </div>
                <div className="flex items-start justify-between gap-3 px-1 pt-3">
                  <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{p.brand_name}</p>
                  <p className="shrink-0 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{priceLabel(p)}</p>
                </div>
                <p className="px-1 pt-1 font-display text-sm text-foreground">{p.product_name}</p>
                <button type="button" onClick={() => setSelected(p)} className="mt-2 inline-flex items-center px-1 font-body text-[10px] uppercase tracking-[0.25em] text-foreground underline-offset-4 hover:underline">
                  <Plus className="mr-1 size-3" />Stage to Project
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent className="rounded-none">
          <DrawerHeader><DrawerTitle className="font-display text-lg font-normal">Stage to Project</DrawerTitle></DrawerHeader>
          <div className="mx-auto w-full max-w-lg px-4 pb-8">
            <p className="mb-3 font-body text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Select active workspace workflow:</p>
            {projects.length === 0 && <p className="font-body text-sm text-muted-foreground">No active projects yet.</p>}
            {projects.map((pr) => (
              <Button key={pr.id} variant="ghost" disabled={saving || !canEdit} onClick={() => stage(pr)}
                className="h-auto min-h-12 w-full justify-start rounded-none border-b border-border px-0 py-3 text-left font-body text-sm font-normal">
                {pr.name}
              </Button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
