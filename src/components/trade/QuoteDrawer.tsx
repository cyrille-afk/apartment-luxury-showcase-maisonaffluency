import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingCart, Trash2, Package, ArrowRight } from "lucide-react";
import { DrawerItemSkeleton } from "@/components/trade/skeletons";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { hydrateQuotePricesFromPicks } from "@/lib/hydrateQuotePricesFromPicks";
import { findQuoteFinishSwatches } from "@/lib/quoteFinishSwatches";
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { dimensionsFromVariantLabel } from "@/lib/drawerDimensions";
import PresentationModeToggle from "./PresentationModeToggle";
import DrawerPricing from "./DrawerPricing";
import { quoteDrawerRetail } from "@/lib/quoteDrawerRetail";
import { quoteLinePricing, summarizeQuoteLines } from "@/lib/quoteLineSummary";
import type { QuoteFinishVariant } from "@/lib/quoteFinishSwatches";

interface QuoteItem {
  id: string;
  image_url?: string | null;
  quantity: number;
  unit_price_cents: number | null;
  unit_price_currency: string | null;
  variant_label: string | null;
  fabric_id: string | null;
  wood_fabric_id: string | null;
  fabric_meters: number | null;
  fabric_upcharge_cents: number | null;
  fabric_currency: string | null;
  fabric?: { name: string; image_url: string | null; tier: string | null; price_per_lm_cents: number | null; currency: string | null } | null;
  wood_fabric?: { name: string; image_url: string | null } | null;
  variant_swatches?: { name: string; image_url: string }[];
  woodRetail?: { cents: number; currency: string } | null;
  product: {
    product_name: string;
    brand_name: string;
    image_url: string | null;
    trade_price_cents: number | null;
    rrp_price_cents: number | null;
    currency: string;
    source_pick_id?: string | null;
    id?: string | null;
    dimensions?: string | null;
    size_variants?: QuoteFinishVariant[] | null;
  };
}


interface QuoteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string | null;
  /** Bump this number to trigger a re-fetch (e.g. after adding an item) */
  refreshKey?: number;
  activePriceSnapshot?: { itemId: string; retailLabel: string | null; netLabel: string | null; configuration?: string; imageUrl?: string | null; finishes?: { name: string; image_url: string }[] } | null;
  /** Live model dimensions for the active line, e.g. "Saint Honoré 280: W 280 x D 160 x H 75 cm". */
  activeDimensionsLabel?: string | null;
}

const formatPrice = (cents: number, currency: string) => {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const QuoteDrawer = ({ open, onOpenChange, quoteId, refreshKey = 0, activePriceSnapshot, activeDimensionsLabel = null }: QuoteDrawerProps) => {
  const { clientSafe } = useClientSafeMode();
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("ma:product-workspace-open", { detail: true }));
    return () => { window.dispatchEvent(new CustomEvent("ma:product-workspace-open", { detail: false })); };
  }, [open]);

  useEffect(() => {
    if (!open || !quoteId) return;
    const fetchItems = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("trade_quote_items")
        .select("id, image_url, quantity, unit_price_cents, unit_price_currency, variant_label, fabric_id, wood_fabric_id, fabric_meters, fabric_upcharge_cents, fabric_currency, fabric:fabrics!fabric_id(name, image_url, tier, price_per_lm_cents, currency), wood_fabric:fabrics!trade_quote_items_wood_fabric_id_fkey(name, image_url), product:trade_products(id, product_name, brand_name, image_url, trade_price_cents, rrp_price_cents, currency, source_pick_id, dimensions, size_variants)")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false });

      if (data) {
        let mapped: QuoteItem[] = (data as any[]).map((d) => ({
          id: d.id,
          image_url: d.image_url ?? null,
          quantity: d.quantity,
          unit_price_cents: d.unit_price_cents,
          unit_price_currency: d.unit_price_currency ?? null,
          variant_label: d.variant_label ?? null,
          fabric_id: d.fabric_id ?? null,
          wood_fabric_id: d.wood_fabric_id ?? null,
          fabric_meters: d.fabric_meters ?? null,
          fabric_upcharge_cents: d.fabric_upcharge_cents ?? null,
          fabric_currency: d.fabric_currency ?? null,
          fabric: Array.isArray(d.fabric) ? d.fabric[0] : d.fabric,
          wood_fabric: Array.isArray(d.wood_fabric) ? d.wood_fabric[0] : d.wood_fabric,
          product: Array.isArray(d.product) ? d.product[0] : d.product,
        }));

        // Fallback: prefer freshest price from designer_curator_picks when the
        // mirror row is missing or stale.
        mapped = await hydrateQuotePricesFromPicks(mapped, "product");

        // The frame swatch can override the variant/catalogue retail basis.
        // Resolve only the saved product + fabric pair, never a net unit price.
        const woodPickIds = [...new Set(mapped.filter((item) => item.wood_fabric_id)
          .map((item) => item.product?.source_pick_id).filter((id): id is string => Boolean(id)))];
        if (woodPickIds.length) {
          const { data: frameRows, error: frameError } = await supabase.from("product_fabrics")
            .select("pick_id, fabric_id, price_cents_a, fabric:fabrics(currency)")
            .in("pick_id", woodPickIds);
          for (const item of mapped) {
            if (!item.wood_fabric_id || !item.product?.source_pick_id) continue;
            if (frameError) {
              item.product = { ...item.product, rrp_price_cents: null, size_variants: null };
              continue;
            }
            const rows = (frameRows ?? []).filter((row) => row.pick_id === item.product.source_pick_id && row.fabric_id === item.wood_fabric_id && (row.price_cents_a ?? 0) > 0);
            if (rows.length === 1) {
              const row = rows[0];
              const fabric = Array.isArray(row.fabric) ? row.fabric[0] : row.fabric;
              if (row.price_cents_a) item.woodRetail = { cents: row.price_cents_a, currency: fabric?.currency || item.product.currency || "EUR" };
            } else if (rows.length > 1) {
              item.product = { ...item.product, rrp_price_cents: null, size_variants: null };
            }
          }
        }

        // Multi-axis finish swatches: dual/triple-axis products (e.g. Angelo
        // M/R table = Base · Top · Size all in stone) only get ONE swatch id
        // saved on the row. Resolve every segment of `variant_label` against
        // this product's swatch library so the drawer shows one thumbnail per
        // selected finish instead of just the first fuzzy match.
        const pickIds = Array.from(new Set(
          mapped.map((m) => m.product?.source_pick_id).filter(Boolean) as string[]
        ));
        if (pickIds.length > 0) {
          const { data: swRows } = await (supabase as any)
            .from("product_fabric_swatches_public")
            .select("pick_id, fabric_id, name, image_url, sort_order, is_active")
            .in("pick_id", pickIds)
            .order("sort_order", { ascending: true });
          const byPick = new Map<string, { fabric_id?: string | null; name: string; image_url: string; sort_order?: number | null }[]>();
          for (const r of (swRows || []) as any[]) {
            if (!r || r.is_active === false || !r.image_url || !r.name) continue;
            const list = byPick.get(r.pick_id) || [];
            list.push({ fabric_id: r.fabric_id ?? null, name: String(r.name), image_url: String(r.image_url), sort_order: r.sort_order ?? null });
            byPick.set(r.pick_id, list);
          }
          for (const item of mapped) {
            const pid = item.product?.source_pick_id;
            if (!pid || !item.variant_label) continue;
            const lib = byPick.get(pid);
            if (!lib || lib.length === 0) continue;
            const matched = findQuoteFinishSwatches(item.variant_label, lib)
              .map((swatch) => ({ name: swatch.name, image_url: swatch.image_url || "" }))
              .filter((swatch) => swatch.image_url);
            if (matched.length > 0) item.variant_swatches = matched;
          }
        }


        // For items without a price, try to find a priced record via fuzzy matching
        const needsPrice = mapped.filter((m) => m.product && !m.product.trade_price_cents && !m.product.rrp_price_cents);
        if (needsPrice.length > 0) {
          const { data: priced } = await supabase
            .from("trade_products")
            .select("product_name, brand_name, trade_price_cents, rrp_price_cents, currency")
            .or("trade_price_cents.not.is.null,rrp_price_cents.not.is.null");

          if (priced && priced.length > 0) {
            const normalize = (s: string) =>
              s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
            const tokenize = (s: string) =>
              normalize(s).split(" ").filter((t) => t.length > 2);

            type PriceEntry = { name: string; brand: string; cents: number; currency: string };
            const exactLookup = new Map<string, PriceEntry>();
            const entries: PriceEntry[] = [];
            for (const p of priced) {
              const cents = p.trade_price_cents ?? p.rrp_price_cents;
              if (!cents) continue;
              const entry: PriceEntry = { name: p.product_name, brand: p.brand_name, cents, currency: p.currency };
              entries.push(entry);
              exactLookup.set(p.product_name.trim().toLowerCase(), entry);
              const norm = normalize(p.product_name);
              if (norm) exactLookup.set(norm, entry);
            }

            const findMatch = (name: string, brand: string) => {
              const key = name.trim().toLowerCase();
              if (exactLookup.has(key)) return exactLookup.get(key)!;
              const norm = normalize(name);
              if (exactLookup.has(norm)) return exactLookup.get(norm)!;

              // Substring match
              for (const e of entries) {
                const cn = normalize(e.name);
                if (cn.includes(norm) || norm.includes(cn)) return e;
              }

              // Token overlap — use MIN for score to handle short canonical names matched against long hotspot names
              const targetTokens = new Set(tokenize(name));
              const brandNorm = normalize(brand);
              if (targetTokens.size === 0) return undefined;
              let best: PriceEntry | undefined;
              let bestScore = 0;
              for (const e of entries) {
                const ct = tokenize(e.name);
                let overlap = 0;
                for (const t of ct) { if (targetTokens.has(t)) overlap++; }
                // Score relative to the shorter set (so "Ricky Rug" 2/2 = 1.0 when both tokens match)
                const score = overlap / Math.min(targetTokens.size, ct.length);
                // Brand bonus: boost if brands match
                const brandMatch = normalize(e.brand).includes(brandNorm) || brandNorm.includes(normalize(e.brand));
                const adjusted = brandMatch ? score * 1.2 : score;
                if (adjusted > 0.5 && adjusted > bestScore) { bestScore = adjusted; best = e; }
              }
              return best;
            };

            for (const item of mapped) {
              if (item.product && !item.product.trade_price_cents && !item.product.rrp_price_cents) {
                const match = findMatch(item.product.product_name, item.product.brand_name);
                if (match) {
                  item.product.trade_price_cents = match.cents;
                  item.product.currency = match.currency;
                }
              }
            }
          }
        }
        setItems(mapped);
      }
      setLoading(false);
    };
    fetchItems();
  }, [open, quoteId, refreshKey]);

  const removeItem = async (itemId: string) => {
    await supabase.from("trade_quote_items").delete().eq("id", itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] flex flex-col">
        <SheetHeader>
          <div className="flex justify-start pr-8"><PresentationModeToggle /></div>
          <SheetTitle className="font-display text-lg flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Active Quote
            {quoteId && (
              <span className="font-body text-xs text-muted-foreground ml-1">
                QU-{quoteId.slice(0, 6).toUpperCase()}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="font-body text-xs">
            {items.length} {items.length === 1 ? "line item" : "line items"} · {totalQuantity} {totalQuantity === 1 ? "unit" : "units"} in this quote
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 -mx-6 px-6 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <DrawerItemSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-body text-sm text-muted-foreground">No items yet</p>
            </div>
          ) : (
            items.map((savedItem) => {
              const active = activePriceSnapshot?.itemId === savedItem.id ? activePriceSnapshot : null;
              const item = active ? { ...savedItem, image_url: active.imageUrl || savedItem.image_url, variant_label: active.configuration || savedItem.variant_label, variant_swatches: active.finishes?.length ? active.finishes : savedItem.variant_swatches } : savedItem;
              return (
              <div key={item.id} className="relative grid grid-cols-[80px_minmax(0,1fr)] gap-3 p-3 pr-7 rounded-lg border border-border hover:border-foreground/10 transition-colors">
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="w-20 h-20 rounded bg-muted/30 overflow-hidden shrink-0">
                    {(item.image_url || item.product?.image_url) ? (
                      <img src={item.image_url || item.product?.image_url || ""} alt={item.product?.product_name || "Quote item"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  {(item.variant_swatches?.length || item.wood_fabric?.image_url || item.fabric?.image_url) ? (
                    <div className="flex flex-wrap gap-2">
                      {item.variant_swatches && item.variant_swatches.length > 0 ? (
                        item.variant_swatches.map((s) => (
                          <img
                            key={s.image_url}
                            src={s.image_url}
                            alt={s.name}
                            title={s.name}
                            className="w-9 h-9 rounded object-cover ring-1 ring-border"
                            loading="lazy"
                          />
                        ))
                      ) : (
                        item.wood_fabric?.image_url && (
                          <img
                            src={item.wood_fabric.image_url}
                            alt={item.wood_fabric.name || "Finish"}
                            className="w-9 h-9 rounded object-cover ring-1 ring-border"
                            loading="lazy"
                          />
                        )
                      )}
                      {item.fabric?.image_url && (
                        <img
                          src={item.fabric.image_url}
                          alt={item.fabric.name || "Fabric"}
                          className="w-9 h-9 rounded object-cover ring-1 ring-border"
                          loading="lazy"
                        />
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="font-body text-[9px] text-muted-foreground uppercase tracking-wider">
                    {item.product?.brand_name?.includes(' - ') ? item.product.brand_name.split(' - ')[0].trim() : item.product?.brand_name}
                  </p>
                  <p className="font-display text-sm text-foreground leading-tight break-words">
                    {item.product?.product_name}
                  </p>
                  {item.variant_label && (
                    <p className="font-body text-[10px] text-foreground/80 mt-0.5 break-words">
                      <span className="text-muted-foreground">Finish:</span> {item.variant_label}
                    </p>
                  )}
                  {(() => {
                    const isActive = activePriceSnapshot?.itemId === savedItem.id;
                    const dims = isActive
                      ? (activeDimensionsLabel || dimensionsFromVariantLabel(item.variant_label, item.product?.dimensions))
                      : dimensionsFromVariantLabel(item.variant_label, item.product?.dimensions);
                    if (!dims) return null;
                    return (
                      <p className="font-body text-[10px] text-foreground/80 mt-0.5 break-words">
                        <span className="text-muted-foreground">Dimensions:</span> {dims}
                      </p>
                    );
                  })()}
                  {(item.fabric?.name || item.fabric_upcharge_cents) && (
                    <p className="font-body text-[10px] text-foreground/80 mt-0.5 break-words">
                      <span className="text-muted-foreground">Fabric:</span>{" "}
                      {item.fabric?.name || "Selected"}
                      {!clientSafe && item.fabric?.tier ? ` · CAT ${item.fabric.tier}` : ""}
                      {!clientSafe && item.fabric_upcharge_cents ? (
                        <>
                          {" — "}
                          <span className="text-primary font-medium">
                            +{formatPrice(item.fabric_upcharge_cents, item.fabric_currency || item.fabric?.currency || "EUR")}
                          </span>
                          {item.fabric_meters ? <span className="text-muted-foreground"> ({item.fabric_meters} m)</span> : null}
                        </>
                      ) : null}
                    </p>
                  )}

                  <div className="flex flex-col items-start mt-1">
                    <span className="font-body text-[10px] text-muted-foreground">
                      Qty: {item.quantity}
                    </span>
                    {(() => {
                      const snapshot = activePriceSnapshot?.itemId === item.id ? activePriceSnapshot : null;
                      const retail = quoteDrawerRetail(savedItem);
                      const displayCents = item.unit_price_cents ?? item.product?.trade_price_cents ?? item.product?.rrp_price_cents;
                      const displayCurrency = item.unit_price_cents != null
                        ? (item.unit_price_currency || item.product?.currency || "EUR")
                        : (item.product?.currency || "EUR");

                      return <DrawerPricing retailLabel={snapshot ? snapshot.retailLabel : retail ? formatPrice(retail.cents, retail.currency) : null} netLabel={snapshot?.netLabel ?? (displayCents && displayCents > 0 ? formatPrice(displayCents, displayCurrency) : null)} />;
                    })()}
                    {(() => {
                      const pricing = quoteLinePricing(savedItem, clientSafe);
                      if (!pricing) return null;
                      return (
                        <div className="mt-1.5 w-full border-t border-border/60 pt-1.5 space-y-0.5 font-body text-[10px]">
                          <p className="flex items-baseline justify-between gap-2 text-muted-foreground">
                            <span>Unit price</span>
                            <span className="text-foreground">{formatPrice(pricing.unitCents, pricing.currency)}</span>
                          </p>
                          <p className="flex items-baseline justify-between gap-2">
                            <span className="text-muted-foreground">Line total · {item.quantity} {item.quantity === 1 ? "unit" : "units"}</span>
                            <span className="font-medium text-foreground">{formatPrice(pricing.lineTotalCents, pricing.currency)}</span>
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="absolute right-1 top-2 p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ); })
          )}
        </div>

        {!loading && items.length > 0 && (() => {
          const summary = summarizeQuoteLines(items, clientSafe);
          return (
            <div className="border-t border-border pt-3 mt-4 space-y-1.5" data-testid="quote-summary">
              <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Quote summary
              </p>
              <p className="flex items-baseline justify-between font-body text-xs text-muted-foreground">
                <span>{summary.lineCount} {summary.lineCount === 1 ? "product line" : "product lines"}</span>
                <span>{summary.totalUnits} {summary.totalUnits === 1 ? "unit" : "units"} total</span>
              </p>
              {summary.totals.map((total) => (
                <p key={total.currency} className="flex items-baseline justify-between font-body text-sm">
                  <span className="text-muted-foreground">
                    {clientSafe ? "Retail total" : "Quote total"}
                  </span>
                  <span className="font-medium text-foreground">{formatPrice(total.cents, total.currency)}</span>
                </p>
              ))}
              {summary.unpricedCount > 0 && (
                <p className="font-body text-[10px] text-muted-foreground">
                  {summary.unpricedCount} {summary.unpricedCount === 1 ? "line" : "lines"} — Price upon Request
                </p>
              )}
            </div>
          );
        })()}

        {quoteId && (
          <div className="border-t border-border pt-4 mt-4">
            <Link
              to="/trade/quotes/$quoteId"
              params={{ quoteId }}
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-foreground text-background rounded-md font-body text-xs uppercase tracking-wider hover:bg-foreground/90 transition-colors"
            >
              Open Quote Builder
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default QuoteDrawer;
