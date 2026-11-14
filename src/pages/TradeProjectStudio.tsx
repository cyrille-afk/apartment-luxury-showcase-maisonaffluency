import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, FileDown, FileText, Sparkles, Box, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/hooks/useProjects";
import { DotCircleLoader, PageLoader } from "@/components/ui/dot-circle-loader";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { ProjectSpecDrawer } from "@/components/trade/ProjectSpecDrawer";
import { ProjectCuratorialGuide } from "@/components/trade/ProjectCuratorialGuide";
import { ProjectProposalPreview } from "@/components/trade/ProjectProposalPreview";
import { dimensionBadgeLabel } from "@/lib/productDimensions";
import { convertCents, useFxRates, type DisplayCurrency } from "@/components/trade/CurrencyToggle";
import { formatMoneyIn } from "@/lib/displayMoney";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useStudio } from "@/hooks/useStudio";
import { effectiveProjectMultiplier, tradePriceCents, clientPriceCents, clientUnitCents } from "@/lib/tradePricing";
import { StudioBrand } from "@/components/trade/StudioBrand";
import { StudioSidePanel } from "@/components/trade/StudioSidePanel";
import { StudioFocusOverlay } from "@/components/trade/StudioFocusOverlay";
import { StudioPieceMovePicker } from "@/components/trade/StudioPieceMovePicker";
import type { StudioFolderPlacement } from "@/lib/studioPairingFolders";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { StudioFinishControls } from "@/components/trade/StudioFinishControls";
import { resolveStudioSelection, studioAppearance, studioFinishPrice, studioSelectedFinishes, studioVisibleItems, type StudioFinishProduct, type StudioFinishSelection, type StudioFinish } from "@/lib/studioFinishes";
import { moodBoardHandoff } from "@/lib/moodBoardHandoff";
import { readSharedRoomLayout, writeSharedRoomLayout } from "@/lib/sharedRoomLayout";

type StudioItem = {
  id: string;
  product_id: string;
  name: string;
  designer: string;
  image_url: string | null;
  sku: string | null;
  lead_time: string | null;
  dimensions: string | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  size_variants: Array<{ label?: string | null; base?: string | null; top?: string | null }> | null;
  rrp_cents: number | null;
  currency: string;
  source_pick_id: string | null;
  category: string | null;
  subcategory: string | null;
  quantity: number;
  selected_finish: string | null;
  placements: StudioFolderPlacement[];
  catalog: StudioFinishProduct;
  selection: StudioFinishSelection;
  original_finish: string | null;
  catalogue_rrp: number | null;
  glb_url: string | null;
};

function leadLabel(item: StudioItem) {
  if (item.lead_time) return item.lead_time;
  return "On request";
}

function dimsLabel(item: StudioItem) {
  return dimensionBadgeLabel(item);
}

export default function TradeProjectStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [canEdit, setCanEdit] = useState(false);
  const [savingFinishes, setSavingFinishes] = useState(false);
  const [removeItem, setRemoveItem] = useState<StudioItem | null>(null);
  const [removingItem, setRemovingItem] = useState(false);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const { project, loading } = useProject(id);
  const [items, setItems] = useState<StudioItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsVersion, setItemsVersion] = useState(0);
  const { showTradePrice, setShowTradePrice } = useTradePriceMode();
  const { discountPct } = useTradeDiscount();
  const { currentStudio } = useStudio();
  const multiplier = effectiveProjectMultiplier((project as any)?.trade_multiplier, currentStudio?.default_project_markup_percentage);
  const isClientMode = !showTradePrice;
  const [specItemId, setSpecItemId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [displayCurrency] = useTradeDisplayCurrency();
  const fxRates = useFxRates();

  const [curatorialItemId, setCuratorialItemId] = useState<string | null>(null);
  const [curatorialInstanceId, setCuratorialInstanceId] = useState<string | null>(null);
  const [isRecommendationHovered, setIsRecommendationHovered] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isSpecPanelOpen, setIsSpecPanelOpen] = useState(false);
  const [isProposalPreviewOpen, setIsProposalPreviewOpen] = useState(false);
  const specItem = items.find((i) => i.product_id === specItemId) || null;
  const curatorialItem = items.find(i => i.id === curatorialInstanceId && i.product_id === curatorialItemId) || items.find((i) => i.product_id === curatorialItemId) || items[0] || null;
  const openVisualStudio = () => {
    if (!curatorialItem) return;
    setIsSpecPanelOpen(false);
    setIsAiPanelOpen(true);
  };

  const openProposalPreview = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsProposalPreviewOpen(true);
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoadingItems(true);
      const sb = supabase as any;
      const productFields =
        "id, product_name, brand_name, image_url, sku, lead_time, dimensions, width_mm, depth_mm, height_mm, size_variants, trade_price_cents, rrp_price_cents, currency, source_pick_id, glb_url, materials, base_axis_label, top_axis_label, category, subcategory";

      const [q, b] = await Promise.all([
        sb.from("trade_quotes").select("id").eq("project_id", id),
        sb.from("client_boards").select("id, title").eq("project_id", id),
      ]);
      const quoteIds = ((q.data as any[]) || []).map((r) => r.id);
      const boardIds = ((b.data as any[]) || []).map((r) => r.id);
      const folderTitles = new Map<string, string>(((b.data as any[]) || []).map(row => [row.id, row.title]));

      const [qItems, bItems] = await Promise.all([
        quoteIds.length
          ? sb
              .from("trade_quote_items")
              .select(`id, quantity, product_id, variant_label, trade_products(${productFields})`)
              .in("quote_id", quoteIds)
          : Promise.resolve({ data: [] }),
        boardIds.length
          ? sb
              .from("client_board_items")
              .select(`id, board_id, product_id, variant_label, wood_label, fabric_label, procurement_quote_id, source_quote_item_id, trade_products(${productFields})`)
              .in("board_id", boardIds)
          : Promise.resolve({ data: [] }),
      ]);

      const map = new Map<string, StudioItem>();
      const push = (row: any, quantity: number) => {
        const p = row.trade_products;
        if (!p) return;
        const selectedFinish = [row.variant_label, row.wood_label, row.fabric_label].filter(Boolean).join(" / ") || null;
        const key = JSON.stringify([p.id || row.product_id, selectedFinish]);
        const placement: StudioFolderPlacement | null = row.board_id ? { itemId: row.id, folderId: row.board_id, folderTitle: folderTitles.get(row.board_id) || "Project sub-folder", finish: selectedFinish, locked: Boolean(row.procurement_quote_id || row.source_quote_item_id) } : null;
        const existing = map.get(key);
        if (existing) {
          existing.quantity += quantity;
          if (placement) existing.placements.push(placement);
          // Different saved configurations must not masquerade as one selected finish.
          if (existing.selected_finish !== selectedFinish) existing.selected_finish = null;
          return;
        }
        map.set(key, {
          id: row.id,
          product_id: p.id || row.product_id,
          name: p.product_name || "Untitled piece",
          designer: p.brand_name || "—",
          image_url: p.image_url,
          sku: p.sku,
          lead_time: p.lead_time,
          dimensions: p.dimensions,
          width_mm: p.width_mm,
          depth_mm: p.depth_mm,
          height_mm: p.height_mm,
          size_variants: p.size_variants,
          rrp_cents: p.trade_price_cents ?? p.rrp_price_cents ?? null,
          currency: (p.currency || "SGD").toUpperCase(),
          source_pick_id: p.source_pick_id ?? null,
          category: p.category ?? null,
          subcategory: p.subcategory ?? null,
          quantity,
          selected_finish: selectedFinish,
          placements: placement ? [placement] : [],
          original_finish: selectedFinish, catalogue_rrp: p.trade_price_cents ?? p.rrp_price_cents ?? null,
          catalog: { name: p.product_name, variants: p.size_variants ?? [], finishes: [], materials: p.materials, baseLabel: p.base_axis_label, topLabel: p.top_axis_label },
          selection: { ids: {}, locked: false }, glb_url: p.glb_url,
        });
      };

      ((qItems.data as any[]) || []).forEach((r) => push(r, r.quantity || 1));
      ((bItems.data as any[]) || []).forEach((r) => push(r, 1));

      const list = Array.from(map.values());

      // Hydrate prices from the curator pick when the trade_products mirror
      // row is missing a price — the pick is the source of truth and this
      // guarantees the ledger and proposal preview never render blank rows.
      const missing = list.filter((i) => i.rrp_cents == null && i.source_pick_id);
      if (missing.length) {
        const pickIds = Array.from(new Set(missing.map((i) => i.source_pick_id as string)));
        const { data: picks } = await supabase
          .from("designer_curator_picks")
          .select("id, trade_price_cents")
          .in("id", pickIds);
        const priceByPick = new Map(
          ((picks as Array<{ id: string; trade_price_cents: number | null }> | null) || []).map(
            (p) => [p.id, p.trade_price_cents],
          ),
        );
        for (const item of missing) {
          const pickPrice = item.source_pick_id ? priceByPick.get(item.source_pick_id) : undefined;
          if (pickPrice != null) item.rrp_cents = pickPrice;
        }
      }

      const pickIds = [...new Set(list.map(item => item.source_pick_id || item.product_id))];
      const [{ data: links, error: finishError }, { data: picks }, { data: saved, error: savedError }, { data: editable }] = await Promise.all([
        pickIds.length ? sb.from("product_fabrics").select("pick_id,sort_order,price_tier_label,image_indices,price_cents_a,fabrics(id,name,supplier,category,image_url,is_active,price_per_lm_cents,currency)").in("pick_id", pickIds).order("sort_order") : Promise.resolve({ data: [] }),
        pickIds.length ? sb.from("designer_curator_picks").select("id,base_axis_label,top_axis_label,size_variants,materials,com_meters").in("id", pickIds) : Promise.resolve({ data: [] }),
        supabase.from("project_studio_finishes").select("item_key,selection").eq("project_id", id),
        user ? supabase.rpc("can_edit_project", { _project_id: id, _user_id: user.id }) : Promise.resolve({ data: false }),
      ]);
      if (finishError || savedError) toast.error("Studio finishes couldn't load. Please reopen the project to try again.");
      setCanEdit(editable === true && !finishError && !savedError);
      for (const item of list) {
        const pickId = item.source_pick_id || item.product_id;
        const pick = picks?.find((p: any) => p.id === pickId);
        const finishes: StudioFinish[] = (links ?? []).filter((link: any) => link.pick_id === pickId && link.fabrics?.is_active).map((link: any) => ({
          id: link.fabrics.id, name: link.fabrics.name, brand_name: link.fabrics.supplier || item.designer,
          category: link.fabrics.category || "Fabric", material_type: link.fabrics.category, color_family: null,
          image_url: link.fabrics.image_url, tier: link.price_tier_label, framePrice: link.price_cents_a,
          perMetre: link.fabrics.price_per_lm_cents, currency: link.fabrics.currency || item.currency, pictured: link.image_indices?.includes(1),
        }));
        item.catalog = { ...item.catalog, variants: pick?.size_variants ?? item.catalog.variants, baseLabel: pick?.base_axis_label ?? item.catalog.baseLabel, topLabel: pick?.top_axis_label ?? item.catalog.topLabel, materials: pick?.materials ?? item.catalog.materials, comMetres: pick?.com_meters, finishes };
        item.catalogue_rrp = item.rrp_cents;
        item.selection = resolveStudioSelection(item.catalog, item.original_finish, saved?.find(row => row.item_key === item.id)?.selection as StudioFinishSelection | undefined);
        item.rrp_cents = studioFinishPrice(item.catalog, item.selection, item.catalogue_rrp, item.original_finish, (cents, currency) => convertCents(cents, currency || item.currency, item.currency as DisplayCurrency, fxRates));
        item.selected_finish = studioSelectedFinishes(item.catalog, item.selection).map(s => s.finish.name).join(" / ") || item.catalog.materials || "Original catalogue materials";
      }
      setItems(studioVisibleItems(list));
      setLoadingItems(false);
    })();
  }, [id, itemsVersion, user?.id]);

  const changeFinish = async (item: StudioItem, selection: StudioFinishSelection) => {
    if (!id || !user || !canEdit || savingFinishes || removingItem) return;
    setSavingFinishes(true);
    const previous = item;
    const changed = { ...item, selection, selected_finish: studioSelectedFinishes(item.catalog, selection).map(s => s.finish.name).join(" / ") || item.selected_finish,
      rrp_cents: studioFinishPrice(item.catalog, selection, item.catalogue_rrp, item.original_finish, (cents, currency) => convertCents(cents, currency || item.currency, item.currency as DisplayCurrency, fxRates)) };
    setItems(current => current.map(row => row.id === item.id ? changed : row));
    const { error } = await supabase.from("project_studio_finishes").upsert({ project_id: id, item_key: item.id, selection: JSON.parse(JSON.stringify(selection)), updated_by: user.id, updated_at: new Date().toISOString() });
    if (error) { setItems(current => current.map(row => row.id === item.id ? previous : row)); toast.error("Finish couldn't save. Your previous selection is unchanged."); }
    setSavingFinishes(false);
  };
  const confirmRemoval = async () => {
    if (!id || !user || !canEdit || !removeItem || removingItem || savingFinishes || isClientMode) return;
    const item = removeItem;
    setRemovingItem(true);
    setRemovalError(null);
    try {
      const { error } = await supabase.from("project_studio_finishes").upsert({ project_id: id, item_key: item.id, selection: JSON.parse(JSON.stringify({ ...item.selection, excluded: true })), updated_by: user.id, updated_at: new Date().toISOString() }).select("item_key").single();
      if (error) throw error;
      setItems(current => current.filter(row => row.id !== item.id));
      if (curatorialInstanceId === item.id || curatorialItem?.id === item.id) {
        setCuratorialInstanceId(null);
        setCuratorialItemId(null);
        setIsAiPanelOpen(false);
      }
      if (specItemId === item.product_id) setSpecItemId(null);
      setRemoveItem(null);
      toast.success(`${item.name} removed from Project Studio.`);
    } catch {
      setRemovalError("This piece couldn't be removed. Please try again.");
    } finally {
      setRemovingItem(false);
    }
  };
  const finishControls = (item: StudioItem, compact = false) => <StudioFinishControls product={item.catalog} selection={item.selection} compact={compact} disabled={!canEdit || savingFinishes || removingItem || isClientMode} onChange={selection => void changeFinish(item, selection)} />;
  const openInVisualiser = () => {
    if (!id || !items.length || savingFinishes || removingItem) return;
    const stamp = Date.now();
    const pieces = items.flatMap(item => Array.from({ length: item.quantity }, (_, index) => {
      const placement = item.placements[index];
      return {
        id: item.product_id, product_name: item.name, brand_name: item.designer,
        image_url: item.image_url, dimensions: item.dimensions, width_mm: item.width_mm, depth_mm: item.depth_mm,
        category: item.category, subcategory: item.subcategory,
        specItemId: placement && !placement.locked ? placement.itemId : null,
        glb_url: item.glb_url,
        retailCents: item.rrp_cents == null ? null : convertCents(item.rrp_cents, item.currency, "EUR", fxRates),
        appearance: studioAppearance(item.catalog, item.selection),
      };
    }));
    const previous = readSharedRoomLayout(id);
    const layout = moodBoardHandoff(pieces, id, previous?.roomType ?? "living", previous, stamp);
    layout.source = "project-studio";
    writeSharedRoomLayout(layout);
    navigate(`/trade/visualiser?project=${encodeURIComponent(id)}&handoff=curated&stamp=${stamp}`);
  };

  // Every ledger figure is expressed in the member's declared base currency.
  const baseCurrency = useMemo<string>(
    () => (displayCurrency !== "original" ? displayCurrency : items[0]?.currency || "USD"),
    [displayCurrency, items],
  );

  const toBase = useCallback(
    (cents: number | null | undefined, from: string) =>
      cents ? convertCents(cents, from, baseCurrency as DisplayCurrency, fxRates) : 0,
    [baseCurrency, fxRates],
  );

  const money = useCallback(
    (cents: number | null | undefined) => (cents ? formatMoneyIn(cents, baseCurrency) : null),
    [baseCurrency],
  );

  const totals = useMemo(() => {
    const msrp = items.reduce((s, i) => s + toBase(i.rrp_cents, i.currency) * i.quantity, 0);
    const trade = items.reduce((s, i) => s + (tradePriceCents(toBase(i.rrp_cents, i.currency), discountPct) || 0) * i.quantity, 0);
    const clientEstimateCents = items.reduce((s, i) => {
      return s + (clientUnitCents(toBase(i.rrp_cents, i.currency), discountPct, multiplier) || 0) * i.quantity;
    }, 0);
    return { msrp, trade, clientEstimateCents };
  }, [items, toBase, discountPct, multiplier]);

  const budgetCents = totals.msrp ? Math.round(totals.msrp * 1.25) : 0;
  const budgetPct = budgetCents ? Math.min(100, Math.round((totals.msrp / budgetCents) * 100)) : 0;

  if (loading) {
    return (
      <PageLoader />
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center">
        <p className="font-body text-sm text-muted-foreground mb-4">Project not found.</p>
        <Link to="/trade/projects" className="font-body text-xs underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const titleLine = `PROJECT STUDIO // ${project.name.toUpperCase()}`;

  return (
    <div className="-mx-4 md:-mx-8 lg:-mx-12 lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col lg:overflow-hidden">
      {/* Masthead */}
      <div className="shrink-0 border-b border-border px-4 py-6 md:px-8 lg:px-12">
        <Link
          to={`/trade/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Project file
        </Link>
        <h1 className="mt-4 font-body text-lg md:text-2xl uppercase tracking-[0.15em] text-foreground">
           {isClientMode ? <><StudioBrand studio={currentStudio} /> <span className="ml-3">{project.name}</span></> : titleLine}
        </h1>
      </div>

      <div className="flex shrink-0 flex-wrap justify-start gap-2 border-b border-border px-4 py-3 md:px-6">
        <Button variant="outline" aria-haspopup="dialog" disabled={!items.length} onClick={openVisualStudio} className="felix-surface h-10 cursor-pointer rounded-none px-4 py-2 font-body text-[10px] uppercase tracking-[0.15em] transition-colors duration-200 motion-reduce:transition-none [&_svg]:size-3.5"><Sparkles aria-hidden="true" strokeWidth={1.5} />AI Co-Designer</Button>
        <Button variant="studio-utility" aria-controls="studio-spec-panel" aria-expanded={isSpecPanelOpen} onClick={() => setIsSpecPanelOpen(!isSpecPanelOpen)} className="h-10 cursor-pointer rounded-none px-4 py-2 font-body text-[10px] uppercase tracking-[0.15em] transition-colors duration-200 motion-reduce:transition-none">Specsheet ({items.length})</Button>
        {!isClientMode && <Button variant="studio-primary" disabled={loadingItems || !items.length || savingFinishes || !canEdit} onClick={openInVisualiser} className="h-10 cursor-pointer rounded-none px-4 font-body text-[10px] uppercase"><Box className="size-3.5" />Open in Visualiser Sandbox</Button>}
      </div>
      <div className="relative min-h-[70dvh] overflow-hidden lg:min-h-0 lg:flex-1">
        {/* Canvas expands into the space released by either independent drawer. */}
        <section aria-label="Visual canvas" className={`relative flex h-full flex-col bg-background transition-[margin] duration-500 ease-in-out motion-reduce:transition-none ${isSpecPanelOpen ? "lg:ml-[40%]" : "lg:ml-0"}`}>
          {/* Upper zone — visual canvas */}
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div className="px-4 py-6 md:px-8 lg:px-12 lg:py-5">
            <p className="trade-micro-label text-muted-foreground">Visual canvas</p>
          </div>
          {loadingItems ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <div className="px-4 pb-16 md:px-8 lg:px-12">
              <p className="font-body text-sm text-muted-foreground">
                No pieces sourced yet. Add products to a board or quote linked to this project and they
                will compose here.
              </p>
            </div>
          ) : (
            <div className={`grid grid-cols-2 items-start pb-10 transition-all duration-300 ease-in-out motion-reduce:transition-none ${isSpecPanelOpen ? "lg:grid-cols-3 gap-6 px-4 md:px-8 lg:px-12" : "lg:grid-cols-4 gap-4 px-4"}`}>
              {items.map((item, idx) => {
                const dims = dimsLabel(item);
                const isCuratorialActive = curatorialItemId === item.product_id;
                const activate = () => {
                  setCuratorialInstanceId(item.id);
                  setCuratorialItemId(item.product_id);
                  setIsAiPanelOpen(true);
                  setIsSpecPanelOpen(false);
                };
                return (
                  <div key={item.id} className="relative min-w-0">
                  {!isClientMode && canEdit && <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" size="icon" aria-label={`Remove ${item.name} from Visual Canvas`} disabled={savingFinishes || removingItem} className="absolute right-1 top-1 z-10 size-8 cursor-pointer bg-background text-muted-foreground hover:text-destructive" onClick={() => { setRemovalError(null); setRemoveItem(item); }}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove from Project Studio</TooltipContent>
                  </Tooltip>}
                  <figure
                    key={item.product_id}
                    data-curatorial-source={item.product_id}
                    className="group relative min-w-0 cursor-pointer"
                    onClick={activate}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        activate();
                      }
                    }}
                    aria-label={`Open AI curatorial guide for ${item.name}`}
                  >
                    <div data-curatorial-focus={isCuratorialActive && isAiPanelOpen ? "true" : undefined} className={`relative transition-shadow duration-300 ${isCuratorialActive && isAiPanelOpen ? "ring-1 ring-foreground ring-offset-4 ring-offset-background" : ""}`}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                           alt={isClientMode ? item.name : `${item.name} by ${item.designer}`}
                          loading={idx < 4 ? "eager" : "lazy"}
                          className="w-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.01] lg:max-h-[24dvh]"
                        />
                      ) : (
                        <div className="aspect-[4/5] w-full" />
                      )}
                      {isCuratorialActive && isRecommendationHovered && (
                        <span className="pointer-events-none absolute inset-x-0 top-0 font-body text-[8px] uppercase leading-relaxed tracking-[0.15em] text-muted-foreground/70">
                          Anchor target for material match
                        </span>
                      )}
                    </div>

                    <figcaption
                      className="mt-4 space-y-1 text-center"
                    >
                      <span className="block font-body text-[10px] uppercase leading-relaxed tracking-[0.15em] text-muted-foreground">
                        {item.name}
                      </span>
                      <span className="block font-body text-[9px] uppercase leading-relaxed tracking-[0.15em] text-muted-foreground/60">
                        {dims || "\u00a0"}
                      </span>
                    </figcaption>
                  </figure>
                  <div className="mt-1 text-center">
                    {item.placements.length > 0 && <p className="font-body text-[9px] leading-relaxed text-muted-foreground">{[...new Set(item.placements.map(placement => placement.folderTitle))].join(" · ")}</p>}
                    {!isClientMode && <StudioPieceMovePicker projectId={project.id} productId={item.product_id} productName={item.name} placements={item.placements} onMoved={() => setItemsVersion(version => version + 1)} />}
                  </div>
                  {finishControls(item, true)}
                  </div>
                );
              })}
            </div>
          )}
          </div>

        </section>

        <AlertDialog open={removeItem !== null} onOpenChange={open => { if (!open && !removingItem) setRemoveItem(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {removeItem?.name}?</AlertDialogTitle>
              <AlertDialogDescription>This removes the piece from Project Studio, its Specsheet and future Sandbox exports. Your source boards, quotes and orders stay unchanged.</AlertDialogDescription>
            </AlertDialogHeader>
            {removalError && <p role="alert" className="text-sm text-destructive">{removalError}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removingItem}>Cancel</AlertDialogCancel>
              <Button variant="destructive" disabled={removingItem || savingFinishes} onClick={() => void confirmRemoval()}>{removingItem ? "Removing…" : "Remove piece"}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <StudioFocusOverlay open={isAiPanelOpen} onOpenChange={setIsAiPanelOpen} item={curatorialItem} dimensions={curatorialItem ? dimsLabel(curatorialItem) : ""} finishControls={curatorialItem ? finishControls(curatorialItem) : null}>
          <ProjectCuratorialGuide
            docked focused open={isAiPanelOpen} onOpenChange={setIsAiPanelOpen}
            projectId={project.id} projectName={project.name} items={items}
            activeItemId={curatorialItemId} isClientMode={isClientMode}
            onActiveItemChange={productId => { setCuratorialItemId(productId); setCuratorialInstanceId(null); }}
            onCompositionChanged={() => setItemsVersion((version) => version + 1)}
            onRecommendationHover={setIsRecommendationHovered}
          />
        </StudioFocusOverlay>
        <StudioSidePanel id="studio-spec-panel" title="Specsheet" side="left" size="wide" open={isSpecPanelOpen} onClose={() => setIsSpecPanelOpen(false)}>
        <div className="flex min-h-0 flex-1 flex-col px-6 py-6 md:px-8">
          {/* Header — fixed at the top of the left pane */}
          <div className="shrink-0 border-b border-border pb-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="trade-micro-label text-muted-foreground">Client</p>
                <p className="mt-2 font-display text-2xl leading-none text-foreground">
                  {project.client_name || "Unassigned"}
                </p>
                <p className="mt-2 font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  {project.location || "Location TBC"} · {project.status}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 md:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={openProposalPreview}
                  data-proposal-preview-trigger
                  className="inline-flex h-auto items-center gap-1.5 p-0 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-3.5 w-3.5" />
                  [ ⎙ Generate Proposal ]
                </Button>
                <Link
                  to={`/trade/projects/${project.id}?tab=ffe`}
                  className="inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  [ ↓ Export Spec Sheets ]
                </Link>
                <div className="flex items-center gap-2">
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-foreground">
                    Client view
                  </span>
                  <Switch
                    checked={isClientMode}
                    onCheckedChange={(checked) => setShowTradePrice(!checked)}
                    aria-label="Client view"
                  />
                </div>
              </div>
            </div>

            {isClientMode ? (
              <div className="mt-6">
                <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Project status: <span className="text-foreground">Active Development</span>
                </p>
              </div>
             ) : (
               <div data-trade-sensitive className="mt-6">
                <div className="flex items-baseline justify-between font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  <span>Budget allocated</span>
                  <span className="text-foreground">
                    {money(totals.msrp) || "—"} {budgetCents ? `/ ${money(budgetCents)}` : ""}
                  </span>
                </div>
                <div className="mt-2 h-px w-full bg-border">
                  <div className="h-px bg-foreground" style={{ width: `${budgetPct}%` }} />
                </div>
                <p className="mt-2 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/72">
                  {budgetPct}% committed
                </p>
              </div>
            )}
             {!isClientMode && <div data-client-placeholder aria-hidden="true" className="mt-6 h-3 w-40 animate-pulse bg-muted/60" />}
          </div>

          {/* Scrollable ledger body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mt-8 px-1 md:px-2">
              <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-3 border-b border-border pb-4 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                <span>Spec</span>
                <span>Item</span>
                <span className="text-right">Status</span>
              </div>

              {loadingItems ? (
                <div className="py-10 text-center">
                  <DotCircleLoader size="sm" className="text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <p className="py-8 font-body text-xs text-muted-foreground">No line items yet.</p>
              ) : (
                items.map((item, idx) => {
                  const msrp = toBase(item.rrp_cents, item.currency) * item.quantity;
                   const trade = (tradePriceCents(toBase(item.rrp_cents, item.currency), discountPct) || 0) * item.quantity;
                   const client = (clientUnitCents(toBase(item.rrp_cents, item.currency), discountPct, multiplier) || 0) * item.quantity;
                  const expanded = expandedId === item.product_id;
                  return (
                    <div key={item.id} className="border-b border-border">
                      <div
                        className="grid cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3 py-9"
                        onClick={() => setExpandedId(expanded ? null : item.product_id)}
                        role="button"
                        aria-expanded={expanded}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedId(expanded ? null : item.product_id);
                          }
                        }}
                        aria-label={`Toggle details for ${item.name}`}
                      >
                        <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-display text-base text-foreground">
                            {item.name}
                          </span>
                           <span data-trade-sensitive={!isClientMode ? "" : undefined} className="mt-1.5 block font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
                             {isClientMode ? "Curated Collection" : item.designer}
                            {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                          </span>
                           {!isClientMode && <span data-client-placeholder aria-hidden="true" className="h-3 w-24 bg-muted/60 animate-pulse" />}
                        </span>
                        <span className="whitespace-nowrap pt-1 text-right">
                           <span data-trade-sensitive={!isClientMode ? "" : undefined} className="block font-body text-[11px] tracking-[0.05em] text-foreground">
                            {isClientMode
                               ? money(client) || "Price upon Request"
                              : msrp
                                ? money(trade)
                                : "Price upon Request"}
                          </span>
                           {!isClientMode && <span data-client-placeholder aria-hidden="true" className="h-3 w-20 animate-pulse bg-muted/60" />}
                           {!isClientMode && msrp > 0 && (
                             <span data-trade-sensitive className="mt-0.5 block font-body text-[10px] tracking-[0.05em] text-muted-foreground/60 line-through">
                              {money(msrp)}
                            </span>
                          )}
                          <span className="mt-1.5 block font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
                            Specified
                          </span>
                        </span>
                      </div>

                      {item.placements.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 pb-3"><p className="min-w-0 flex-1 font-body text-[9px] leading-relaxed text-muted-foreground">{[...new Set(item.placements.map(placement => placement.folderTitle))].join(" · ")}</p>{!isClientMode && <StudioPieceMovePicker projectId={project.id} productId={item.product_id} productName={item.name} placements={item.placements} onMoved={() => setItemsVersion(version => version + 1)} />}</div>}
                      <div className="pb-4">{finishControls(item)}</div>
                      {expanded && (
                        <div className="pb-9">
                          <dl className="space-y-3">
                              {!isClientMode && <div data-trade-sensitive className="flex items-baseline justify-between gap-4 font-body text-[10px] uppercase tracking-[0.15em]">
                              <dt className="text-muted-foreground/60">Spec</dt>
                              <dd className="text-foreground">{item.sku || "—"}</dd>
                             </div>}
                              <div className="flex items-baseline justify-between gap-4 font-body text-[10px] uppercase tracking-[0.15em]">
                              <dt className="text-muted-foreground/60">Lead</dt>
                              <dd className="text-foreground">{leadLabel(item)}</dd>
                            </div>
                             <div data-trade-sensitive={!isClientMode ? "" : undefined} className="flex items-baseline justify-between gap-4 font-body text-[10px] uppercase tracking-[0.15em]">
                               <dt className="text-muted-foreground/60">{isClientMode ? "Client Price" : "Trade"}</dt>
                              <dd className="tracking-[0.05em] text-foreground">
                                {isClientMode ? (
                                   money(client) || "Price upon Request"
                                ) : msrp ? (
                                  <>
                                    {money(trade)}
                                    <span className="ml-2 text-muted-foreground/60 line-through">
                                      {money(msrp)}
                                    </span>
                                  </>
                                ) : (
                                  "Price upon Request"
                                )}
                              </dd>
                            </div>
                             {!isClientMode && <div data-client-placeholder aria-hidden="true" className="h-3 w-24 animate-pulse bg-muted/60" />}
                          </dl>
                          <button
                            type="button"
                            onClick={() => setSpecItemId(item.product_id)}
                            className="mt-4 font-body text-[10px] uppercase tracking-[0.15em] text-foreground underline underline-offset-4 hover:no-underline"
                          >
                            Open full specification
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Totals */}
              {items.length > 0 && (
                 <div data-trade-sensitive={!isClientMode ? "" : undefined} className="flex items-baseline justify-between gap-4 border-b border-foreground py-9">
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-foreground">
                    {isClientMode ? "Total Estimate" : "Total (Trade)"}
                  </span>
                  <span className="font-body text-[11px] tracking-[0.05em] text-foreground">
                  {isClientMode ? money(totals.clientEstimateCents) || "—" : money(totals.trade) || "—"}
                  </span>
                </div>
              )}
               {!isClientMode && items.length > 0 && <div data-client-placeholder aria-hidden="true" className="h-4 w-32 my-9 bg-muted/60 animate-pulse" />}
            </div>
          </div>
        </div>
        </StudioSidePanel>

      </div>

       <ProjectSpecDrawer item={specItem} clientMode={isClientMode} onClose={() => setSpecItemId(null)} />
      <ProjectProposalPreview
        open={isProposalPreviewOpen}
        onOpenChange={setIsProposalPreviewOpen}
        projectName={project.name}
        clientName={project.client_name}
        location={project.location}
        items={items.map((i) => ({ ...i, rrp_cents: toBase(i.rrp_cents, i.currency) || null }))}
        isClientMode={isClientMode}
         tradeDiscount={discountPct}
         markupMultiplier={multiplier}
         studio={currentStudio}
        currency={baseCurrency}
      />
    </div>
  );
}
