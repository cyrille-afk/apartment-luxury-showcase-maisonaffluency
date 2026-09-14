import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/hooks/useProjects";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { Switch } from "@/components/ui/switch";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";

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
  rrp_cents: number | null;
  quantity: number;
};

const TRADE_DISCOUNT = 0.08;

function money(cents: number | null | undefined) {
  if (!cents) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function leadLabel(item: StudioItem) {
  if (item.lead_time) return item.lead_time;
  return "On request";
}

function dimsLabel(item: StudioItem) {
  if (item.width_mm && item.depth_mm && item.height_mm) {
    return `${item.width_mm} × ${item.depth_mm} × ${item.height_mm} mm`;
  }
  return item.dimensions || null;
}

export default function TradeProjectStudio() {
  const { id } = useParams<{ id: string }>();
  const { project, loading } = useProject(id);
  const [items, setItems] = useState<StudioItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const { showTradePrice, setShowTradePrice } = useTradePriceMode();
  const isClientMode = !showTradePrice;

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoadingItems(true);
      const sb = supabase as any;
      const productFields =
        "id, product_name, brand_name, image_url, sku, lead_time, dimensions, width_mm, depth_mm, height_mm, trade_price_cents, rrp_price_cents";

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
          rrp_cents: p.trade_price_cents ?? p.rrp_price_cents ?? null,
          quantity,
        });
      };

      ((qItems.data as any[]) || []).forEach((r) => push(r, r.quantity || 1));
      ((bItems.data as any[]) || []).forEach((r) => push(r, 1));

      setItems(Array.from(map.values()));
      setLoadingItems(false);
    })();
  }, [id]);

  const totals = useMemo(() => {
    const msrp = items.reduce((s, i) => s + (i.rrp_cents || 0) * i.quantity, 0);
    const trade = Math.round(msrp * (1 - TRADE_DISCOUNT));
    const clientEstimateCents = items.reduce((s, i) => {
      const line = (i.rrp_cents || 0) * i.quantity;
      return s + Math.round(line / 100) * 100;
    }, 0);
    return { msrp, trade, clientEstimateCents };
  }, [items]);

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
    <div className="-mx-4 md:-mx-8 lg:-mx-12 -mt-4 md:-mt-8 lg:-mt-12">
      {/* Masthead */}
      <div className="border-b border-border px-4 py-6 md:px-8 lg:px-12">
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

      <div className="grid grid-cols-1 lg:grid-cols-[60%_40%]">
        {/* LEFT — visual canvas */}
        <section className="border-b border-border lg:border-b-0 lg:border-r lg:border-border">
          <div className="px-4 py-6 md:px-8 lg:px-12">
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
            <div className="columns-2 gap-0 px-0 pb-12 md:columns-3">
              {items.map((item, idx) => {
                const dims = dimsLabel(item);
                return (
                  <figure
                    key={item.product_id}
                    className="group relative mb-0 break-inside-avoid"
                  >
                    <div className="relative overflow-hidden bg-muted">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={`${item.name} by ${item.designer}`}
                          loading={idx < 4 ? "eager" : "lazy"}
                          className="w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="aspect-[4/5] w-full bg-muted" />
                      )}

                      {/* Wireframe / crosshair overlay */}
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <span className="absolute left-0 right-0 top-1/2 h-px bg-foreground/25" />
                        <span className="absolute bottom-0 top-0 left-1/2 w-px bg-foreground/25" />
                        <span className="absolute inset-4 border border-foreground/25" />
                        <span className="absolute left-4 top-4 h-2 w-2 border-l border-t border-foreground/60" />
                        <span className="absolute right-4 top-4 h-2 w-2 border-r border-t border-foreground/60" />
                        <span className="absolute bottom-4 left-4 h-2 w-2 border-b border-l border-foreground/60" />
                        <span className="absolute bottom-4 right-4 h-2 w-2 border-b border-r border-foreground/60" />
                        <span className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-2">
                          <span className="bg-background/85 px-1.5 py-1 font-body text-[10px] uppercase tracking-[0.15em] text-foreground">
                            {String(idx + 1).padStart(2, "0")} // {item.name}
                          </span>
                          {dims && (
                            <span className="bg-background/85 px-1.5 py-1 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                              {dims}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </figure>
                );
              })}
            </div>
          )}
        </section>

        {/* RIGHT — procurement ledger */}
        <aside className="px-4 py-6 md:px-8 lg:px-10">
          {/* Header */}
          <div className="border-b border-border pb-6">
            <p className="trade-micro-label text-muted-foreground">Client</p>
            <p className="mt-2 font-display text-2xl leading-none text-foreground">
              {project.client_name || "Unassigned"}
            </p>
            <p className="mt-2 font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              {project.location || "Location TBC"} · {project.status}
            </p>

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

            <div className="mt-6 flex items-center justify-between">
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

          {/* Ledger */}
          <div className="mt-6">
            <div className="grid grid-cols-[44px_minmax(0,1fr)_88px_104px] gap-2 border-b border-border pb-2 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <span>Spec</span>
              <span>Item</span>
              <span className="pr-3">Lead</span>
              <span className="text-right">{isClientMode ? "MSRP" : "Trade"}</span>
            </div>

            {loadingItems ? (
              <div className="py-10 text-center">
                <DotCircleLoader size="sm" className="text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 font-body text-xs text-muted-foreground">No line items yet.</p>
            ) : (
              items.map((item, idx) => {
                const msrp = (item.rrp_cents || 0) * item.quantity;
                const trade = Math.round(msrp * (1 - TRADE_DISCOUNT));
                return (
                  <div
                    key={item.product_id}
                    className="grid grid-cols-[44px_minmax(0,1fr)_88px_104px] items-start gap-2 border-b border-border py-4"
                  >
                    <span className="pr-3 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {String(idx + 1).padStart(2, "0")}
                      <span className="block text-muted-foreground/72">{item.sku || "—"}</span>
                    </span>
                    <span className="min-w-0">
                      <Link
                        to={`/trade/products/${item.product_id}`}
                        className="block truncate font-display text-sm text-foreground hover:underline"
                      >
                        {item.name}
                      </Link>
                      <span className="mt-1 block font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/72">
                        {item.designer}
                        {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                      </span>
                    </span>
                    <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {leadLabel(item)}
                    </span>
                    <span className="text-right font-body text-[11px] tracking-[0.05em] text-foreground">
                      {isClientMode ? (
                        money(msrp) || "Price upon Request"
                      ) : msrp ? (
                        <>
                          {money(trade)}
                          <span className="mt-1 block text-[10px] text-muted-foreground/72 line-through">
                            {money(msrp)}
                          </span>
                        </>
                      ) : (
                        "Price upon Request"
                      )}
                    </span>
                  </div>
                );
              })
            )}

            {/* Totals */}
            {items.length > 0 && (
              <div className="grid grid-cols-[44px_minmax(0,1fr)_88px_104px] gap-2 border-b border-foreground py-4">
                <span />
                <span className="font-body text-[10px] uppercase tracking-[0.15em] text-foreground">
                  {isClientMode ? "Total Estimate" : "Total (Trade)"}
                </span>
                <span />
                <span className="text-right font-body text-[11px] tracking-[0.05em] text-foreground">
                {isClientMode ? money(totals.clientEstimateCents) || "—" : money(totals.trade) || "—"}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex flex-col gap-3">
              <Link
                to={`/trade/projects/${project.id}?tab=tearsheets`}
                className="inline-flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.15em] text-foreground underline underline-offset-4 hover:no-underline"
              >
                <FileText className="h-3.5 w-3.5" /> Generate White-Label PDF Proposal
              </Link>
              <Link
                to={`/trade/projects/${project.id}?tab=ffe`}
                className="inline-flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.15em] text-foreground underline underline-offset-4 hover:no-underline"
              >
                <FileDown className="h-3.5 w-3.5" /> Export Specification Sheets
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
