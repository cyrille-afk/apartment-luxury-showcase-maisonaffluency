import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_VISUAL_RESULTS, MAX_VISUAL_RESULTS, selectVisualMatches, visualMatchPercent } from "@/lib/visualSearchResults";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import { cn } from "@/lib/utils";
import {
  backfillProductImageEmbeddings,
  getImageEmbeddingStatus,
  searchCatalogueByImage,
  type VisualSearchMatch,
} from "@/lib/visualSearch.functions";

type Phase = "idle" | "loading" | "results";

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

/** Downscale the upload to <=1024px JPEG so the embedding request stays small. */
async function fileToResizedDataUrl(file: File, maxSide = 1024, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

/** Visual Search: real image matching — the uploaded photo is embedded with the same multimodal model as the catalogue imagery and ranked by vector similarity. */
export default function VisualSearchPanel() {
  const { user, isAdmin } = useAuth();
  const { currentStudio, canEdit } = useStudio();
  const { projects } = useProjects({ activeOnly: true });
  const { showTradePrice, discountPct } = useTradePriceMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [matches, setMatches] = useState<VisualSearchMatch[]>([]);
  const [minimumMatch, setMinimumMatch] = useState(0);
  const [resultCount, setResultCount] = useState(DEFAULT_VISUAL_RESULTS);
  const visibleMatches = selectVisualMatches(matches, minimumMatch, resultCount);
  const [selected, setSelected] = useState<VisualSearchMatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [indexing, setIndexing] = useState(false);

  const runSearch = useServerFn(searchCatalogueByImage);
  const runBackfill = useServerFn(backfillProductImageEmbeddings);
  const runStatus = useServerFn(getImageEmbeddingStatus);

  const { data: coverage, refetch: refetchCoverage } = useQuery({
    queryKey: ["image-embedding-coverage"],
    enabled: isAdmin,
    queryFn: () => runStatus(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const ids = matches.map((m) => m.pick_id);
  const { data: prices } = useQuery({
    queryKey: ["visual-search-prices", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("designer_curator_picks")
        .select("id, trade_price_cents, currency").in("id", ids);
      return new Map((data ?? []).map((r) => [r.id, r]));
    },
  });

  const priceLabel = (pickId: string) => {
    const row = prices?.get(pickId);
    const cents = Number(row?.trade_price_cents) || 0;
    if (!cents) return "Price upon Request";
    const cur = row?.currency || "EUR";
    return showTradePrice ? fmt(Math.round(cents * (1 - discountPct / 100)), cur) : fmt(cents, cur);
  };

  const handleFile = useCallback(async (file?: File | null) => {
    if (!file || !file.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
    setPhase("loading");
    setMatches([]);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      const { matches: found } = await runSearch({ data: { image: dataUrl } });
      setMatches(found);
      setPhase("results");
      if (found.length === 0) toast.message("No close visual matches found in the catalogue yet.");
    } catch (e) {
      setPhase("idle");
      toast.error(e instanceof Error ? e.message : "Visual search failed. Please try again.");
    }
  }, [runSearch]);

  const reset = () => { if (preview) URL.revokeObjectURL(preview); setPreview(null); setPhase("idle"); setMatches([]); };

  const indexCatalogue = async () => {
    if (indexing) return;
    setIndexing(true);
    try {
      const result = await runBackfill();
      await refetchCoverage();
      if (result.paused) toast.error(result.pauseReason || "Automatic indexing is paused.");
      else toast.success("Automatic indexing resumed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Indexing failed.");
    } finally {
      setIndexing(false);
      refetchCoverage();
    }
  };

  const stage = async (project: Project) => {
    if (!selected || !user || saving || !canEdit) return;
    setSaving(true);
    try {
      const { data } = await supabase.from("trade_products").select("id").eq("source_pick_id", selected.pick_id).limit(1).maybeSingle();
      const productId = data?.id ?? null;
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
      toast.success(`${selected.title} added to ${project.name}`);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not stage this piece.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {isAdmin && coverage && (
        <div className="flex flex-wrap items-center gap-3 border border-border/60 bg-muted/20 px-4 py-2.5">
          <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Catalogue imagery indexed: {coverage.embedded} / {coverage.total}
          </p>
          {coverage.paused && <p role="alert" className="text-sm text-destructive">{coverage.pauseReason}</p>}
          {(coverage.paused || coverage.failed > 0) && (
            <Button
              variant="outline"
              size="sm"
              disabled={indexing}
              onClick={indexCatalogue}
              className="h-7 rounded-none font-body text-[10px] uppercase tracking-[0.2em]"
            >
              {indexing ? <Loader2 className="mr-1 size-3 animate-spin" /> : <RefreshCw className="mr-1 size-3" />}
              {indexing ? "Resuming…" : "Resume indexing"}
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-8 border-b border-border pb-6 sm:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 font-body text-xs text-muted-foreground">
            <span title="Image similarity score, not a probability of an exact product match.">Minimum visual match</span>
            <output className="tabular-nums text-foreground">{minimumMatch}%</output>
          </div>
          <Slider thumbLabel="Minimum visual match" min={0} max={100} step={1} value={[minimumMatch]} onValueChange={([value]) => setMinimumMatch(value ?? 0)} />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 font-body text-xs text-muted-foreground">
            <span>Maximum results</span>
            <output className="tabular-nums text-foreground">{resultCount}</output>
          </div>
          <Slider thumbLabel="Maximum results" min={1} max={MAX_VISUAL_RESULTS} step={1} value={[resultCount]} onValueChange={([value]) => setResultCount(value ?? DEFAULT_VISUAL_RESULTS)} />
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files?.[0]); }}
        className={cn(
          "relative flex w-full flex-col items-center justify-center border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center transition-colors md:py-20",
          dragging && "border-foreground/50 bg-muted/40",
        )}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
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
          <p aria-live="polite" className="mb-4 font-body text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Curated Matches — {visibleMatches.length} results</p>
          {phase === "results" && visibleMatches.length === 0 && <p className="mb-6 font-display text-base text-muted-foreground">No catalogue pieces meet this minimum visual match.</p>}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {visibleMatches.map((m) => (
              <div key={m.pick_id} className="bg-card p-3">
                <div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-background">
                  {m.image_url && <img src={optimizeImageUrl(m.image_url, "w_500,c_limit,q_auto,f_auto")} alt={m.title ?? "Catalogue piece"} loading="lazy" className="h-full w-full object-contain" />}
                </div>
                <div className="flex items-start justify-between gap-3 px-1 pt-3">
                  <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{m.designer_name}</p>
                  <p className="shrink-0 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{priceLabel(m.pick_id)}</p>
                </div>
                <p className="px-1 pt-1 font-display text-sm text-foreground">{m.title}</p>
                <p className="px-1 pt-0.5 font-body text-[10px] tracking-[0.1em] text-muted-foreground/70">
                  {visualMatchPercent(m.similarity)}% visual match
                </p>
                <button type="button" onClick={() => setSelected(m)} className="mt-2 inline-flex items-center px-1 font-body text-[10px] uppercase tracking-[0.25em] text-foreground underline-offset-4 hover:underline">
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
