import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { buildComparisonPdf, comparisonImage, COMPARISON_COVER_LAYOUTS, comparisonCoverLayout } from "@/lib/comparisonPdf";
import { comparatorSwatchesQueryOptions } from "@/hooks/useComparatorSwatches";
import { comparatorSwatches } from "@/lib/comparatorSwatches";
import { downloadBlob } from "@/lib/furnishingSchedulePdf";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Search, X, Heart, ChevronDown, Bookmark, Link2, FileDown, Trash2, FolderOpen, FilePenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { useTradeProductPricing } from "@/hooks/useTradeProductPricing";
import type { TradeProduct } from "@/lib/tradeProducts";
import { comparatorDesignerGroups, comparatorPrices, comparatorDetails, fetchComparatorDetails, resolvePublicUrlsByPickIds } from "@/lib/comparatorCatalogue";
import { useAuth } from "@/hooks/useAuth";
import { ProjectPicker } from "@/components/trade/ProjectPicker";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import { useStudio } from "@/hooks/useStudio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMPARATOR_CURRENCIES, comparatorCurrency, convertComparatorCents, formatMoney, type ComparatorCurrency, type ComparatorRates } from "@/lib/comparatorCurrency";
import { useSearchParams } from "@/lib/router-compat";
import { useComparatorDraft } from "@/hooks/useComparatorDraft";
import { ProductComparisonTable } from "@/components/trade/ProductComparisonTable";
import DesignerNoteToolbar from "@/components/trade/DesignerNoteToolbar";
import { ComparatorSelectionDrawer } from "@/components/trade/ComparatorSelectionDrawer";
import { restoreSavedComparison, type ComparisonCoverEdits } from "@/lib/comparatorDraft";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Server-synced rates only (refreshed by the currency sync job); no bundled fallback.
function useComparatorRates() {
  return useQuery({
    queryKey: ["comparator-fx-rates"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("currency_rates").select("base_currency,target_currency,rate,last_updated_at");
      if (error) throw error;
      const rates: ComparatorRates = {}; let updated = 0;
      for (const row of data ?? []) {
        const rate = Number(row.rate);
        if (!(rate > 0)) continue;
        rates[`${row.base_currency}_${row.target_currency}`] = rate;
        updated = Math.max(updated, Date.parse(row.last_updated_at) || 0);
      }
      return { rates, updatedAt: updated || null };
    },
  });
}

function ComparisonPrice({ product, net, currency }: { product: TradeProduct | null; net: boolean; currency: ComparatorCurrency }) {
  const { discountPct } = useTradePriceMode();
  const { data, isLoading, isError } = useTradeProductPricing(product?.id);
  const fx = useComparatorRates();
  if (!product) return <>—</>;
  if (isLoading) return <>Loading…</>;
  if (isError) return <>Pricing unavailable</>;
  if (!data) return <>Price upon Request</>;
  const prices = comparatorPrices(data, discountPct);
  const cents = net ? prices.trade : prices.retail;
  if (cents === null) return <>Price upon Request</>;
  const prefix = data.price_prefix ? `${data.price_prefix} ` : "";
  const source = data.currency || "EUR";
  const original = `${prefix}${formatMoney(cents, source)}`;
  if (source === currency) return <span className="font-semibold">{original}</span>;
  const converted = fx.data ? convertComparatorCents(cents, source, currency, fx.data.rates) : null;
  if (converted === null) return <span className="flex flex-col gap-0.5"><span className="font-semibold">{original}</span><span className="text-xs font-normal text-muted-foreground">{fx.isLoading ? "Converting…" : `${currency} conversion unavailable`}</span></span>;
  return <span className="flex flex-col gap-0.5"><span className="font-semibold">{prefix}{formatMoney(converted, currency)}</span><span className="text-xs font-normal text-muted-foreground">Original: {original}</span></span>;
}

export default function TradeComparator() {
  const { user } = useAuth();
  const { currentStudio } = useStudio();
  const [displayPref, setDisplayPref] = useTradeDisplayCurrency();
  const displayCurrency = comparatorCurrency(displayPref);
  const fxRates = useComparatorRates();
  const { liveProducts, isLoading: catalogueLoading } = useTradeProducts();
  const [params, setParams] = useSearchParams();
  const requestedShortlist = params.get("shortlist");
  const { draft, setDraft, ready: draftReady, hasStoredDraft } = useComparatorDraft(user?.id, requestedShortlist);
  const { search, compareList, letter, source, shortlistName } = draft;
  const openDesigners = new Set(draft.openDesigners);
  const setSearch = (search: string) => setDraft(d => ({ ...d, search }));
  const setLetter = (letter: string) => setDraft(d => ({ ...d, letter }));
  const setSource = (source: "catalogue" | "favorites") => setDraft(d => ({ ...d, source }));
  const setShortlistName = (shortlistName: string) => setDraft(d => ({ ...d, shortlistName }));
  const setCompareList = (update: TradeProduct[] | ((list: TradeProduct[]) => TradeProduct[])) => setDraft(d => ({ ...d, compareList: typeof update === "function" ? update(d.compareList) : update }));
  const setOpenDesigners = (update: (value: Set<string>) => Set<string>) => setDraft(d => ({ ...d, openDesigners: [...update(new Set(d.openDesigners))] }));
  const projectId = params.get("project");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverForm, setCoverForm] = useState<ComparisonCoverEdits>({});
  const coverScope = projectId || "unassigned";
  const [visiblePieces, setVisiblePieces] = useState<TradeProduct[] | null>(null);
  const actionsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".trade-editorial-header");
    const breadcrumbs = document.querySelector<HTMLElement>("[data-trade-breadcrumb-bar]");
    const updateOffset = () => {
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const breadcrumbHeight = window.innerWidth >= 768 ? breadcrumbs?.getBoundingClientRect().height ?? 0 : 0;
      actionsRef.current?.style.setProperty("--comparison-actions-top", `${headerHeight + breadcrumbHeight}px`);
    };
    const observer = new ResizeObserver(updateOffset);
    if (header) observer.observe(header);
    if (breadcrumbs) observer.observe(breadcrumbs);
    updateOffset();
    window.addEventListener("resize", updateOffset);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateOffset); };
  }, []);
  const { data: details } = useQuery({ queryKey: ["comparator-details", user?.id], enabled: !!user, queryFn: fetchComparatorDetails });
  const catalogue = liveProducts.map(p => ({ ...p, ...details?.get(p.id) }));
  const { showTradePrice, discountLabel, tierLabel } = useTradePriceMode();

  const { data: favorites = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ["comparator-favorites", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("trade_favorites").select("product_id, trade_products(id, source_pick_id, product_name, brand_name, category, materials, dimensions, width_mm, depth_mm, height_mm, size_variants, image_url, lead_time)").eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
  });
  const favoriteProducts = favorites.flatMap(f => {
    const row = f.trade_products;
    if (!row) return [];
    const existing = catalogue.find(p => p.id === row.source_pick_id || p.trade_product_id === f.product_id || p.id === f.product_id);
    return [existing ?? { id: row.source_pick_id || row.id, trade_product_id: row.id, product_name: row.product_name, brand_name: row.brand_name, category: row.category || "Uncategorized", tags: [], image_url: row.image_url, lead_time: row.lead_time, ...comparatorDetails(row) }];
  });
  const groups = comparatorDesignerGroups(source === "favorites" ? favoriteProducts : catalogue, search, letter);
  const isLoading = catalogueLoading || (source === "favorites" && favoritesLoading);

  const addToCompare = (p: TradeProduct) => {
    if (compareList.length >= 4) return;
    if (compareList.find((c) => c.id === p.id)) return;
    setCompareList((prev) => [...prev, p]);
  };

  const removeFromCompare = (id: string) => {
    setCompareList((prev) => prev.filter((p) => p.id !== id));
  };

  const queryClient = useQueryClient();
  const { discountPct } = useTradePriceMode();
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedSearch, setSavedSearch] = useState("");
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const { data: allComparisons = [], isPending: savedLoading, isError: savedError, refetch: refetchAllComparisons } = useQuery({
    queryKey: ["comparator-saved-library", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("comparator_shortlists").select("id, name, items, project_id, created_at, projects(name)").eq("user_id", user?.id || "").is("room_slug", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const { data: shortlists = [], refetch: refetchShortlists } = useQuery({
    queryKey: ["comparator-shortlists", user?.id, projectId],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase.from("comparator_shortlists").select("id, name, items, share_token, created_at, project_id").eq("user_id", user?.id || "").order("created_at", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
  const saveShortlist = async () => {
    if (!user || compareList.length === 0 || saving || !projectId) return;
    setSaving(true);
    try {
    // Public-safe snapshot only: no prices are stored, so shared links can never leak trade figures.
    const publicUrls = await resolvePublicUrlsByPickIds(compareList.map((p) => p.id));
    const items = compareList.map((p) => ({ id: p.id, product_name: p.product_name, brand_name: p.brand_name, category: p.category, dimensions: p.dimensions, materials: p.materials, lead_time: p.lead_time ?? null, designer_notes: draft.pieceNotes[p.id]?.trim() || null, image_url: p.image_url, public_url: publicUrls.get(p.id) ?? null }));
    const { error } = await supabase.from("comparator_shortlists").insert({ user_id: user.id, project_id: projectId, name: shortlistName.trim() || "Shortlist", items });
    if (error) { toast.error("Could not save shortlist"); return; }
    setShortlistName(""); toast.success("Shortlist saved"); refetchShortlists(); refetchAllComparisons();
    } catch { toast.error("Could not save shortlist"); } finally { setSaving(false); }
  };
  const openShortlist = (saved: { id: string; project_id: string | null }) => {
    const next = new URLSearchParams(params);
    next.set("shortlist", saved.id);
    if (saved.project_id) next.set("project", saved.project_id); else next.delete("project");
    setPendingRestore(saved.id);
    setParams(next);
    setSavedOpen(false);
  };
  const shareShortlist = async (token: string) => {
    await navigator.clipboard.writeText(`https://www.maisonaffluency.com/shortlist/${token}`);
    toast.success("Client link copied — shows pieces without prices");
  };
  const [openedShortlist, setOpenedShortlist] = useState<string | null>(null);
  useEffect(() => {
    if (!draftReady || (hasStoredDraft && pendingRestore !== requestedShortlist)) return;
    if (!requestedShortlist || (requestedShortlist === openedShortlist && pendingRestore !== requestedShortlist) || !details || catalogueLoading) return;
    const saved = allComparisons.find(s => s.id === requestedShortlist) || shortlists.find(s => s.id === requestedShortlist);
    if (!saved || !Array.isArray(saved.items)) return;
    setDraft(() => restoreSavedComparison(saved.items, saved.name, [...catalogue, ...favoriteProducts]));
    setOpenedShortlist(requestedShortlist);
    setPendingRestore(null);
  }, [draftReady, hasStoredDraft, pendingRestore, requestedShortlist, openedShortlist, allComparisons, shortlists, details, catalogueLoading, catalogue, favoriteProducts]);
  const deleteShortlist = async (id: string) => {
    await supabase.from("comparator_shortlists").delete().eq("id", id);
    refetchShortlists();
    refetchAllComparisons();
  };
  const readCoverDetails = async (): Promise<ComparisonCoverEdits> => {
    let project = null;
    if (projectId) {
      const { data, error } = await supabase.from("projects").select("name, client_name, location, location_city, location_neighborhood, style").eq("id", projectId).single();
      if (error) throw new Error("Project details unavailable");
      project = data;
    }
    return {
      projectName: project?.name || "", comparisonName: shortlistName,
      clientName: project?.client_name || "",
      location: project?.location?.trim() || [project?.location_neighborhood, project?.location_city].filter(Boolean).join(", "),
      style: project?.style || "",
    };
  };
  const editCover = async () => {
    setCoverLoading(true);
    try {
      setCoverForm({ ...await readCoverDetails(), ...draft.coverEdits[coverScope] });
      setCoverOpen(true);
    } catch { toast.error("The project's details could not be loaded. Please try again."); }
    finally { setCoverLoading(false); }
  };
  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
    // Only the pieces currently visible after facet filtering are exported;
    // when no filter is active this is the full comparison list.
    const exportList = visiblePieces ?? compareList;
    let coverDetails: ComparisonCoverEdits;
    try { coverDetails = { ...await readCoverDetails(), ...draft.coverEdits[coverScope] }; }
    catch { toast.error("The project's details could not be loaded. Please try again."); return; }
    const missingPricing = exportList.filter(p => !queryClient.getQueryData(["trade-product-pricing", p.id]));
    if (missingPricing.length) {
      const { data, error } = await supabase.functions.invoke("trade-catalog-pricing", { body: { pickIds: missingPricing.map(p => p.id) } });
      if (error) throw error;
      const rows = data?.products ?? [];
      for (const product of missingPricing) {
        const row = rows.find((r: { id: string; source_pick_id?: string }) => r.source_pick_id === product.id || r.id === product.id || r.id === product.trade_product_id);
        if (row) queryClient.setQueryData(["trade-product-pricing", product.id], row);
      }
    }
    const fmt = (c: number | null, cur = "EUR") => c == null ? "Price upon Request" : new Intl.NumberFormat("en-IE", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100);
    const linkedSwatches = await queryClient.fetchQuery(comparatorSwatchesQueryOptions(exportList.map(p => p.id)));
    const imageCache = new Map<string, ReturnType<typeof comparisonImage>>();
    const textureImage = (url: string) => {
      let pending = imageCache.get(url);
      if (!pending) { pending = comparisonImage(url, true); imageCache.set(url, pending); }
      return pending;
    };
    const fx = fxRates.data ?? (await fxRates.refetch()).data ?? null;
    let converted = false;
    const showOriginalPrices = (coverDetails.originalPrices ?? "true") !== "false";
    const priceText = (c: number | null, cur: string, prefix: string) => {
      if (c == null) return "Price upon Request";
      const original = `${prefix}${fmt(c, cur)}`;
      if (cur === displayCurrency) return original;
      const value = fx ? convertComparatorCents(c, cur, displayCurrency, fx.rates) : null;
      if (value === null) return `${original}\n${displayCurrency} conversion unavailable`;
      converted = true;
      return showOriginalPrices ? `${prefix}${formatMoney(value, displayCurrency)}\nOriginal: ${original}` : `${prefix}${formatMoney(value, displayCurrency)}`;
    };
    const pieces = await Promise.all(exportList.map(async (p) => {
      const pricing = queryClient.getQueryData<any>(["trade-product-pricing", p.id]);
      const prices = pricing ? comparatorPrices(pricing, discountPct) : { retail: null, trade: null };
      const cur = pricing?.currency || "EUR";
      const prefix = pricing?.price_prefix ? `${pricing.price_prefix} ` : "";
      const swatches = await Promise.all(comparatorSwatches(p.materials, linkedSwatches.get(p.id) ?? []).map(async s => ({ name: s.name, color: s.color, image: s.imageUrl ? await textureImage(s.imageUrl) : null })));
      return { name: p.product_name, swatches, image: p.image_url ? await comparisonImage(p.image_url) : null, values: { brand_name: p.brand_name, category: p.category, dimensions: p.dimensions ?? "", materials: p.materials ?? "", lead_time: p.lead_time ?? "", designer_notes: draft.pieceNotes[p.id]?.trim() || "", rrp_price_cents: priceText(prices.retail, cur, prefix), trade_price_cents: priceText(prices.trade, cur, prefix) } };
    }));
    const fxNote = `Prices shown in ${displayCurrency}${converted ? ` using Maison Affluency's synced FX rates${fx?.updatedAt ? `, last updated ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZoneName: "short" }).format(fx.updatedAt)}` : ""}${showOriginalPrices ? "; original supplier prices shown beneath" : ""}` : ""}.`;
    downloadBlob(await buildComparisonPdf(pieces, FIELDS, showTradePrice ? "Product Comparison (Trade)" : "Product Comparison", { ...coverDetails, fxNote }), "product-comparison.pdf");
    } catch { toast.error("The PDF could not be prepared with all pictures. Please try again."); } finally { setExporting(false); }
  };

  useEffect(() => {
    if (!details || !draftReady) return;
    setCompareList(list => list.map(p => ({ ...p, ...details.get(p.id) })));
  }, [details, draftReady]);

  const comparisonSlots = Array.from({ length: 4 }, (_, index) => compareList[index] ?? null);

  const FIELDS = [
    { key: "brand_name", label: "Brand" },
    { key: "category", label: "Category" },
    { key: "dimensions", label: "Dimensions" },
    { key: "materials", label: "Materials" },
    { key: "lead_time", label: "Lead Time" },
    { key: "designer_notes", label: "Designer Notes" },
    { key: "rrp_price_cents", label: "RRP" },
    ...(showTradePrice
      ? [{ key: "trade_price_cents", label: `Trade Price · ${tierLabel} −${discountLabel}` }]
      : []),
  ];

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6 [@media(min-width:1440px)]:max-w-[min(90vw,1800px)]">



        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl text-foreground">Product Comparator</h1>
          <Button variant="outline" size="sm" onClick={() => { setSavedOpen(true); refetchAllComparisons(); }}><FolderOpen className="mr-2 h-4 w-4" />Saved comparisons</Button>
        </div>
        <Dialog open={savedOpen} onOpenChange={setSavedOpen}>
          <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display font-normal">Saved comparisons</DialogTitle><DialogDescription className="sr-only">Choose a saved product comparison</DialogDescription></DialogHeader>
            <Input value={savedSearch} onChange={event => setSavedSearch(event.target.value)} placeholder="Search comparisons or projects…" aria-label="Search saved comparisons" />
            {savedLoading ? <p role="status" className="py-6 text-sm text-muted-foreground">Loading comparisons…</p> : savedError ? <div role="alert"><p className="text-sm text-destructive">Saved comparisons could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => refetchAllComparisons()}>Try again</Button></div> : <ul className="divide-y divide-border">
              {allComparisons.filter(saved => `${saved.name} ${saved.projects?.name || ""}`.toLowerCase().includes(savedSearch.toLowerCase())).map(saved => <li key={saved.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0"><p className="break-words font-display text-base">{saved.name}</p><p className="mt-1 text-xs text-muted-foreground">{saved.projects?.name || "No project"} · {Array.isArray(saved.items) ? saved.items.length : 0} pieces</p></div>
                <Button variant="outline" size="sm" onClick={() => openShortlist(saved)} aria-label={`Restore ${saved.name}`}><FolderOpen className="mr-2 h-3.5 w-3.5" />Restore</Button>
              </li>)}
              {!allComparisons.some(saved => `${saved.name} ${saved.projects?.name || ""}`.toLowerCase().includes(savedSearch.toLowerCase())) && <li className="py-6 text-sm text-muted-foreground">{allComparisons.length ? "No matching comparisons." : "No saved comparisons yet."}</li>}
            </ul>}
          </DialogContent>
        </Dialog>

        <Dialog open={coverOpen} onOpenChange={setCoverOpen}>
          <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display font-normal">PDF cover details</DialogTitle><DialogDescription className="sr-only">Project and client details for the comparison cover</DialogDescription></DialogHeader>
            <form className="space-y-4" onSubmit={event => {
              event.preventDefault();
              setDraft(d => ({ ...d, coverEdits: { ...d.coverEdits, [coverScope]: { ...coverForm } } }));
              setCoverOpen(false); toast.success("Cover details saved");
            }}>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-muted-foreground">Cover layout</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {COMPARISON_COVER_LAYOUTS.map(option => {
                    const active = comparisonCoverLayout(coverForm.layout) === option.id;
                    return <button key={option.id} type="button" aria-pressed={active} onClick={() => setCoverForm(form => ({ ...form, layout: option.id }))}
                      className={`rounded-sm border p-3 text-left transition-colors ${active ? "border-primary bg-muted" : "border-border hover:bg-muted/50"}`}>
                      <span className="block text-sm font-medium text-foreground">{option.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                    </button>;
                  })}
                </div>
              </fieldset>
              <div className="flex items-start gap-2 border-t border-border pt-4">
                <Checkbox id="cover-originalPrices" className="mt-0.5" checked={coverForm.originalPrices !== "false"} onCheckedChange={checked => setCoverForm(form => ({ ...form, originalPrices: checked ? "true" : "false" }))} />
                <div className="space-y-0.5">
                  <Label htmlFor="cover-originalPrices" className="text-xs font-medium text-muted-foreground">Show original supplier prices in the PDF</Label>
                  <p className="text-xs text-muted-foreground">When off, price rows show only the converted price.</p>
                </div>
              </div>
              {([
                ["projectName", "Project name"], ["comparisonName", "Comparison title"],
                ["clientName", "Client name"], ["location", "Apartment / location"], ["style", "Style / apartment details"],
              ] as const).map(([key, label]) => <div key={key} className="space-y-1.5">
                <Label htmlFor={`cover-${key}`} className="text-xs font-medium text-muted-foreground">{label}</Label>
                <Input id={`cover-${key}`} maxLength={500} value={coverForm[key] || ""} onChange={event => setCoverForm(form => ({ ...form, [key]: event.target.value }))} />
              </div>)}
              <div className="space-y-1.5">
                <Label htmlFor="cover-designerNotes" className="text-xs font-medium text-muted-foreground">Designer notes</Label>
                <DesignerNoteToolbar targetId="cover-designerNotes" maxLength={2000} value={coverForm.designerNotes || ""} onChange={value => setCoverForm(form => ({ ...form, designerNotes: value }))} />
                <Textarea id="cover-designerNotes" maxLength={2000} rows={4} value={coverForm.designerNotes || ""} onChange={event => setCoverForm(form => ({ ...form, designerNotes: event.target.value }))} placeholder="Notes for the cover, e.g. intent for the scheme" />
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" disabled={coverLoading} onClick={async () => {
                  setCoverLoading(true);
                  try { const fresh = await readCoverDetails(); setCoverForm(form => ({ ...fresh, layout: form.layout, designerNotes: form.designerNotes, originalPrices: form.originalPrices })); }
                  catch { toast.error("The project's details could not be loaded. Please try again."); }
                  finally { setCoverLoading(false); }
                }}>Use project details</Button>
                <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setCoverOpen(false)}>Cancel</Button><Button type="submit" disabled={!draftReady || coverLoading}>Save cover details</Button></div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <ComparatorSelectionDrawer count={compareList.length}>
          <div className="flex flex-col gap-4 [@media(min-width:1440px)]:flex-row [@media(min-width:1440px)]:items-center">
            <div className="relative w-full shrink-0 [@media(min-width:1440px)]:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search designers or pieces…" aria-label="Search designers or pieces" className="pl-10 font-body text-sm" />
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
              {comparisonSlots.map((product, index) => (
                <div
                  key={product?.id ?? `empty-${index}`}
                  className="flex h-11 min-w-0 items-center gap-2 border border-border bg-muted/20 px-3"
                >
                  {product ? (
                    <>
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="h-7 w-7 shrink-0 object-cover" />
                      ) : (
                        <span className="h-7 w-7 shrink-0 bg-muted" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate font-body text-xs text-foreground">{product.product_name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCompare(product.id)}
                        className="h-7 w-7 shrink-0"
                        aria-label={`Remove ${product.product_name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Product {index + 1}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2" role="group" aria-label="Product source">
              <Button variant={source === "catalogue" ? "default" : "outline"} size="sm" onClick={() => setSource("catalogue")}>Designers A–Z</Button>
              <Button variant={source === "favorites" ? "default" : "outline"} size="sm" onClick={() => { setSource("favorites"); setLetter(""); setSearch(""); }}><Heart className="mr-2 h-3 w-3" />Favourites</Button>
            </div>
            <span className="font-body text-xs text-muted-foreground">{compareList.length}/4 selected</span>
          </div>
          <nav className="mt-3 flex flex-wrap gap-1" aria-label="Designer alphabet">
            {["", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(initial => (
              <Button key={initial} variant={letter === initial ? "default" : "ghost"} size="sm" aria-pressed={letter === initial} onClick={() => setLetter(initial)} className="h-8 min-w-8 px-2">{initial || "All"}</Button>
            ))}
          </nav>
          <div className="mt-3 max-h-80 min-h-44 overflow-y-auto">
            {isLoading ? <div className="flex h-44 items-center justify-center"><DotCircleLoader size="sm" /></div> : groups.length === 0 ? (
              <p className="py-10 text-center font-body text-sm text-muted-foreground">{source === "favorites" ? "No matching favourites" : "No matching designers or pieces"}</p>
            ) : groups.map(({ designer, pieces }) => {
              const expanded = source === "favorites" || !!search.trim() || openDesigners.has(designer);
              return <div key={designer} className="border-b border-border">
                <Button variant="ghost" aria-expanded={expanded} onClick={() => setOpenDesigners(prev => { const next = new Set(prev); if (next.has(designer)) next.delete(designer); else next.add(designer); return next; })} className="h-12 w-full justify-between rounded-none px-2">
                  <span className="font-body text-sm">{designer} <span className="ml-2 text-xs text-muted-foreground">{pieces.length} curator picks</span></span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </Button>
                {expanded && <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pieces.map(p => {
                    const onList = compareList.some(c => c.id === p.id);
                    return <Button key={p.id} variant="outline" onClick={() => addToCompare(p)} disabled={onList || compareList.length >= 4} aria-label={`Compare ${p.product_name}`} className={`h-20 min-w-0 justify-start gap-3 p-3 text-left ${onList ? "border-primary bg-primary/5" : ""}`}>
                      <span className="h-12 w-12 shrink-0 overflow-hidden bg-muted">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-body text-xs font-normal">{p.product_name}</span><span className="block truncate font-body text-[10px] font-normal text-muted-foreground">{p.subtitle || p.brand_name}</span></span>
                    </Button>;
                  })}
                </div>}
              </div>;
            })}
          </div>
        </ComparatorSelectionDrawer>

        <section ref={actionsRef} aria-label="Comparison actions" className="sticky top-[var(--comparison-actions-top,4rem)] z-20 flex flex-col gap-3 border-b border-border bg-background py-3 [&_button]:h-9 [&_button]:font-body [&_button]:text-xs [&_button]:font-medium">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={shortlistName} onChange={(e) => setShortlistName(e.target.value)} placeholder="Shortlist name (e.g. client, project)" aria-label="Shortlist name" className="h-9 w-full font-body text-xs sm:w-64" />
            <ProjectPicker value={projectId} onChange={value => { const next = new URLSearchParams(params); if (value) next.set("project", value); else next.delete("project"); setParams(next); }} />
            <Button size="sm" variant="outline" onClick={saveShortlist} disabled={compareList.length === 0 || !projectId || saving}><Bookmark className="mr-2 h-3.5 w-3.5" />{saving ? "Saving…" : "Save shortlist to project"}</Button>
            <Button size="sm" variant="outline" onClick={() => void editCover()} disabled={!draftReady || exporting || coverLoading}><FilePenLine className="mr-2 h-3.5 w-3.5" />{coverLoading ? "Loading details…" : "Edit PDF cover"}</Button>
            <div className="flex items-center gap-2 sm:ml-auto">
              {currentStudio && <span className="hidden font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:inline">{currentStudio.display_name || currentStudio.name}</span>}
              <Label htmlFor="comparator-currency" className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/70">Display Currency</Label>
              <Select value={displayCurrency} onValueChange={value => setDisplayPref(comparatorCurrency(value))}>
                <SelectTrigger id="comparator-currency" className="h-9 w-24 font-body text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{COMPARATOR_CURRENCIES.map(c => <SelectItem key={c} value={c} className="font-body text-xs">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={() => void exportPdf()} disabled={compareList.length === 0 || exporting || (visiblePieces !== null && visiblePieces.length === 0)}><FileDown className="mr-2 h-3.5 w-3.5" />{exporting ? "Preparing PDF…" : visiblePieces && visiblePieces.length !== compareList.length ? `Export visible (${visiblePieces.length})` : "Export comparison PDF"}</Button>
          </div>
          {shortlists.length > 0 && <ul className="flex flex-wrap gap-2" aria-label="Saved shortlists">
            {shortlists.map((s: any) => (
              <li key={s.id} className="flex items-center gap-1 border border-border px-2 py-1">
                <Button variant="ghost" size="sm" className="h-7 px-2 font-body text-xs" onClick={() => openShortlist(s)}>{s.name} ({(s.items || []).length})</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Copy client link for ${s.name}`} onClick={() => shareShortlist(s.share_token)}><Link2 className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Delete ${s.name}`} onClick={() => deleteShortlist(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </li>))}
          </ul>}
        </section>

        <ProductComparisonTable products={comparisonSlots} fields={FIELDS} onRemove={removeFromCompare} onVisibleProductsChange={setVisiblePieces} renderNote={product => <div><DesignerNoteToolbar targetId={`piece-note-${product.id}`} maxLength={1000} value={draft.pieceNotes[product.id] ?? ""} onChange={value => setDraft(d => ({ ...d, pieceNotes: { ...d.pieceNotes, [product.id]: value } }))} /><Textarea id={`piece-note-${product.id}`} aria-label={`Designer notes for ${product.product_name}`} maxLength={1000} rows={3} placeholder="Add notes…" value={draft.pieceNotes[product.id] ?? ""} onChange={e => { const value = e.target.value; setDraft(d => ({ ...d, pieceNotes: { ...d.pieceNotes, [product.id]: value } })); }} className="min-h-20 resize-y border-border/70 bg-background/60 font-body text-sm" /></div>} renderPrice={(product, net) => <ComparisonPrice product={product} net={net} currency={displayCurrency} />} />
        {compareList.length > 0 && <p className="mt-3 font-body text-[10px] tracking-wide text-muted-foreground">
          Prices converted to {displayCurrency} with Maison Affluency's synced FX rates{fxRates.data?.updatedAt ? ` · last updated ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(fxRates.data.updatedAt)}` : ""}. Original supplier prices shown beneath.
        </p>}
      </div>
    </>
  );
}
