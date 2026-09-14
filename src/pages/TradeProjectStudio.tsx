import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/hooks/useProjects";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { ProjectSpecDrawer } from "@/components/trade/ProjectSpecDrawer";
import { ProjectCuratorialGuide } from "@/components/trade/ProjectCuratorialGuide";
import { ProjectProposalPreview } from "@/components/trade/ProjectProposalPreview";
import { dimensionBadgeLabel } from "@/lib/productDimensions";
import { convertCents, useFxRates, type DisplayCurrency } from "@/components/trade/CurrencyToggle";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";

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
  quantity: number;
};

const TRADE_DISCOUNT = 0.08;

function leadLabel(item: StudioItem) {
  if (item.lead_time) return item.lead_time;
  return "On request";
}

function dimsLabel(item: StudioItem) {
  return dimensionBadgeLabel(item);
}

export default function TradeProjectStudio() {
  const { id } = useParams<{ id: string }>();
  const { project, loading } = useProject(id);
  const [items, setItems] = useState<StudioItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsVersion, setItemsVersion] = useState(0);
  const { showTradePrice, setShowTradePrice } = useTradePriceMode();
  const isClientMode = !showTradePrice;
  const [specItemId, setSpecItemId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [displayCurrency] = useTradeDisplayCurrency();
  const fxRates = useFxRates();

  const [curatorialItemId, setCuratorialItemId] = useState<string | null>(null);
  const [isRecommendationHovered, setIsRecommendationHovered] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [isProposalPreviewOpen, setIsProposalPreviewOpen] = useState(false);
  const specItem = items.find((i) => i.product_id === specItemId) || null;

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
        "id, product_name, brand_name, image_url, sku, lead_time, dimensions, width_mm, depth_mm, height_mm, size_variants, trade_price_cents, rrp_price_cents, currency, source_pick_id";

      const [q, b] = await Promise.all([
        sb.from("trade_quotes").select("id").eq("project_id", id),
        sb.from("client_boards").select("id").eq("project_id", id),
      ]);
      const quoteIds = ((q.data as any[]) || []).map((r) => r.id);
      const boardIds = ((b.data as any[]) || []).map((r) => r.id);

      const [qItems, bItems] = await Promise.all([
        quoteIds.length
          ? sb
              .from("trade_quote_items")
              .select(`id, quantity, product_id, trade_products(${productFields})`)
              .in("quote_id", quoteIds)
          : Promise.resolve({ data: [] }),
        boardIds.length
          ? sb
              .from("client_board_items")
              .select(`id, product_id, trade_products(${productFields})`)
              .in("board_id", boardIds)
          : Promise.resolve({ data: [] }),
      ]);

      const map = new Map<string, StudioItem>();
      const push = (row: any, quantity: number) => {
        const p = row.trade_products;
        if (!p) return;
        const key = p.id || row.product_id;
        const existing = map.get(key);
        if (existing) {
          existing.quantity += quantity;
          return;
        }
        map.set(key, {
          id: row.id,
          product_id: key,
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
          quantity,
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

      setItems(list);
      setLoadingItems(false);
    })();
  }, [id, itemsVersion]);

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
    (cents: number | null | undefined) => {
      if (!cents) return null;
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: baseCurrency,
          maximumFractionDigits: 0,
        }).format(cents / 100);
      } catch {
        return `${baseCurrency} ${Math.round(cents / 100).toLocaleString("en-US")}`;
      }
    },
    [baseCurrency],
  );

  const totals = useMemo(() => {
    const msrp = items.reduce((s, i) => s + toBase(i.rrp_cents, i.currency) * i.quantity, 0);
    const trade = Math.round(msrp * (1 - TRADE_DISCOUNT));
    const clientEstimateCents = items.reduce((s, i) => {
      const line = toBase(i.rrp_cents, i.currency) * i.quantity;
      return s + Math.round(line / 100) * 100;
    }, 0);
    return { msrp, trade, clientEstimateCents };
  }, [items, toBase]);

  const budgetCents = totals.msrp ? Math.round(totals.msrp * 1.25) : 0;
  const budgetPct = budgetCents ? Math.min(100, Math.round((totals.msrp / budgetCents) * 100)) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <DotCircleLoader size="sm" className="text-muted-foreground" />
      </div>
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
    <div className="-mx-4 -mt-4 md:-mx-8 md:-mt-8 lg:-mx-12 lg:-mt-12 lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col lg:overflow-hidden">
      {/* Masthead */}
      <div className="shrink-0 border-b border-border px-4 py-6 md:px-8 lg:px-12">
        <Link
          to={`/trade/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Project file
        </Link>
        <h1 className="mt-4 font-body text-lg md:text-2xl uppercase tracking-[0.15em] text-foreground">
          {titleLine}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:min-h-0 lg:flex-1 lg:grid-cols-[60%_40%]">
        {/* LEFT — central workspace: canvas (upper) + AI pane (lower) */}
        <section className="relative flex flex-col border-b border-border bg-background lg:min-h-0 lg:border-b-0 lg:border-r lg:border-border">
          {/* Upper zone — visual canvas */}
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div className="px-4 py-6 md:px-8 lg:px-12 lg:py-5">
            <p className="trade-micro-label text-muted-foreground">Visual canvas</p>
          </div>
          {loadingItems ? (
            <div className="flex items-center justify-center py-24">
              <DotCircleLoader size="sm" className="text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 pb-16 md:px-8 lg:px-12">
              <p className="font-body text-sm text-muted-foreground">
                No pieces sourced yet. Add products to a board or quote linked to this project and they
                will compose here.
              </p>
            </div>
          ) : (
            <div className="columns-2 gap-8 px-4 pb-10 md:columns-3 md:gap-10 md:px-8 lg:px-12">
              {items.map((item, idx) => {
                const dims = dimsLabel(item);
                const isCuratorialActive = curatorialItemId === item.product_id;
                const activate = () => {
                  setCuratorialItemId(item.product_id);
                  window.dispatchEvent(new CustomEvent("project-curator:open"));
                };
                return (
                  <figure
                    key={item.product_id}
                    data-curatorial-source={item.product_id}
                    className="group relative mb-12 cursor-pointer break-inside-avoid md:mb-16"
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
                    <div className="relative">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={`${item.name} by ${item.designer}`}
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
                      className={`mt-4 space-y-1 text-center transition-opacity duration-500 ${
                        isCuratorialActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus:opacity-100"
                      }`}
                    >
                      <span className="block font-body text-[10px] uppercase leading-relaxed tracking-[0.15em] text-muted-foreground">
                        {item.name}
                      </span>
                      <span className="block font-body text-[9px] uppercase leading-relaxed tracking-[0.15em] text-muted-foreground/60">
                        {dims}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
          </div>

          {/* Lower zone — AI Curatorial Assistant, anchored to the base of the workspace */}
          <div
            className={`flex shrink-0 flex-col border-t border-border bg-background transition-all duration-500 ease-in-out lg:min-h-0 ${
              isAiPanelOpen ? "lg:h-[35%]" : "lg:h-0 lg:border-0 lg:bg-transparent"
            }`}
          >
            <ProjectCuratorialGuide
              docked
              open={isAiPanelOpen}
              onOpenChange={setIsAiPanelOpen}
              projectId={project.id}
              projectName={project.name}
              items={items}
              activeItemId={curatorialItemId}
              isClientMode={isClientMode}
              onActiveItemChange={setCuratorialItemId}
              onCompositionChanged={() => setItemsVersion((version) => version + 1)}
              onRecommendationHover={setIsRecommendationHovered}
            />
          </div>
        </section>

        {/* RIGHT — procurement ledger */}
        <aside className="flex flex-col px-6 py-6 md:px-10 lg:min-h-0 lg:overflow-hidden lg:px-14">
          {/* Header — fixed at the top of the right pane */}
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
              <div className="mt-6">
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
          </div>

          {/* Scrollable ledger body */}
          <div className="flex-1 overflow-y-auto">
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
                  const trade = Math.round(msrp * (1 - TRADE_DISCOUNT));
                  const expanded = expandedId === item.product_id;
                  return (
                    <div key={item.product_id} className="border-b border-border">
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
                          <span className="mt-1.5 block font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
                            {item.designer}
                            {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                          </span>
                        </span>
                        <span className="whitespace-nowrap pt-1 text-right">
                          <span className="block font-body text-[11px] tracking-[0.05em] text-foreground">
                            {isClientMode
                              ? money(msrp) || "Price upon Request"
                              : msrp
                                ? money(trade)
                                : "Price upon Request"}
                          </span>
                          {!isClientMode && msrp > 0 && (
                            <span className="mt-0.5 block font-body text-[10px] tracking-[0.05em] text-muted-foreground/60 line-through">
                              {money(msrp)}
                            </span>
                          )}
                          <span className="mt-1.5 block font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
                            Specified
                          </span>
                        </span>
                      </div>

                      {expanded && (
                        <div className="pb-9">
                          <dl className="space-y-3">
                            <div className="flex items-baseline justify-between gap-4 font-body text-[10px] uppercase tracking-[0.15em]">
                              <dt className="text-muted-foreground/60">Spec</dt>
                              <dd className="text-foreground">{item.sku || "—"}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-4 font-body text-[10px] uppercase tracking-[0.15em]">
                              <dt className="text-muted-foreground/60">Lead</dt>
                              <dd className="text-foreground">{leadLabel(item)}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-4 font-body text-[10px] uppercase tracking-[0.15em]">
                              <dt className="text-muted-foreground/60">{isClientMode ? "MSRP" : "Trade"}</dt>
                              <dd className="tracking-[0.05em] text-foreground">
                                {isClientMode ? (
                                  money(msrp) || "Price upon Request"
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
                <div className="flex items-baseline justify-between gap-4 border-b border-foreground py-9">
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-foreground">
                    {isClientMode ? "Total Estimate" : "Total (Trade)"}
                  </span>
                  <span className="font-body text-[11px] tracking-[0.05em] text-foreground">
                  {isClientMode ? money(totals.clientEstimateCents) || "—" : money(totals.trade) || "—"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>

      </div>

      <ProjectSpecDrawer item={specItem} onClose={() => setSpecItemId(null)} />
      <ProjectProposalPreview
        open={isProposalPreviewOpen}
        onOpenChange={setIsProposalPreviewOpen}
        projectName={project.name}
        clientName={project.client_name}
        location={project.location}
        items={items}
        isClientMode={isClientMode}
        tradeDiscount={TRADE_DISCOUNT}
      />
    </div>
  );
}
