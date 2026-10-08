import { Helmet } from "react-helmet-async";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Search, X, Heart, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { useTradeProductPricing } from "@/hooks/useTradeProductPricing";
import type { TradeProduct } from "@/lib/tradeProducts";
import { comparatorDesignerGroups, comparatorPrices } from "@/lib/comparatorCatalogue";
import { useAuth } from "@/hooks/useAuth";

function ComparisonPrice({ product, net }: { product: TradeProduct | null; net: boolean }) {
  const { discountPct } = useTradePriceMode();
  const { data, isLoading, isError } = useTradeProductPricing(product?.id);
  if (!product) return <>—</>;
  if (isLoading) return <>Loading…</>;
  if (isError) return <>Pricing unavailable</>;
  if (!data) return <>Price upon Request</>;
  const prices = comparatorPrices(data, discountPct);
  const cents = net ? prices.trade : prices.retail;
  if (cents === null) return <>Price upon Request</>;
  return <>{data.price_prefix ? `${data.price_prefix} ` : ""}{new Intl.NumberFormat("en-IE", { style: "currency", currency: data.currency || "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}</>;
}

export default function TradeComparator() {
  const [search, setSearch] = useState("");
  const [compareList, setCompareList] = useState<TradeProduct[]>([]);
  const [letter, setLetter] = useState("");
  const [source, setSource] = useState<"catalogue" | "favorites">("catalogue");
  const [openDesigners, setOpenDesigners] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { liveProducts, isLoading: catalogueLoading } = useTradeProducts();
  const { showTradePrice, discountLabel, tierLabel } = useTradePriceMode();

  const { data: favorites = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ["comparator-favorites", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("trade_favorites").select("product_id").eq("user_id", user.id);
      if (error) throw error;
      return (data || []).map(f => f.product_id);
    },
  });
  const favoriteIds = new Set(favorites);
  const groups = comparatorDesignerGroups(liveProducts, search, letter, source === "favorites" ? favoriteIds : undefined);
  const isLoading = catalogueLoading || (source === "favorites" && favoritesLoading);

  const addToCompare = (p: TradeProduct) => {
    if (compareList.length >= 4) return;
    if (compareList.find((c) => c.id === p.id)) return;
    setCompareList((prev) => [...prev, p]);
  };

  const removeFromCompare = (id: string) => {
    setCompareList((prev) => prev.filter((p) => p.id !== id));
  };

  const comparisonSlots = Array.from({ length: 4 }, (_, index) => compareList[index] ?? null);

  const FIELDS = [
    { key: "brand_name", label: "Brand" },
    { key: "category", label: "Category" },
    { key: "dimensions", label: "Dimensions" },
    { key: "materials", label: "Materials" },
    { key: "lead_time", label: "Lead Time" },
    { key: "rrp_price_cents", label: "RRP" },
    ...(showTradePrice
      ? [{ key: "trade_price_cents", label: `Trade Price · ${tierLabel} −${discountLabel}` }]
      : []),
  ];

  return (
    <>
      <Helmet><title>Product Comparator — Trade Portal</title></Helmet>
      <div className="mx-auto w-full max-w-6xl space-y-6 [@media(min-width:1440px)]:max-w-[min(90vw,1800px)]">



        <div>
          <h1 className="font-display text-2xl text-foreground">Product Comparator</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            
          </p>
        </div>

        <section className="border-y border-border py-5">
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
              <Button variant={source === "favorites" ? "default" : "outline"} size="sm" onClick={() => setSource("favorites")}><Heart className="mr-2 h-3 w-3" />Favourites</Button>
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
              const expanded = !!search.trim() || openDesigners.has(designer);
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
        </section>

        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full min-w-[900px] table-fixed text-left">
            <colgroup>
              <col className="w-36" />
              {comparisonSlots.map((_, index) => <col key={index} />)}
            </colgroup>
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-4" />
                  {comparisonSlots.map((product, index) => (
                    <th key={product?.id ?? `heading-${index}`} className="px-4 py-4 align-top">
                      <div className="relative min-h-44">
                        {product ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFromCompare(product.id)}
                              className="absolute right-0 top-0 z-10 h-7 w-7 bg-background/80"
                              aria-label={`Remove ${product.product_name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                            {product.image_url && (
                              <img src={product.image_url} alt="" className="mb-3 h-36 w-full bg-muted object-contain" />
                            )}
                            <p className="font-display text-sm font-normal text-foreground">{product.product_name}</p>
                          </>
                        ) : (
                          <div className="flex h-36 items-center justify-center border border-dashed border-border font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                            Select product {index + 1}
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((field) => (
                  <tr key={field.key} data-trade-sensitive={field.key === "trade_price_cents" ? "" : undefined} className="border-b border-border/50">
                    <td className="px-4 py-2.5 font-body text-[10px] uppercase tracking-wider text-muted-foreground">{field.label}</td>
                    {comparisonSlots.map((product, index) => {
                      const val = product ? (product as any)[field.key] : null;
                      return (
                        <td key={product?.id ?? `${field.key}-${index}`} className="px-4 py-3 font-body text-sm text-foreground align-top">
                          {field.key === "rrp_price_cents" || field.key === "trade_price_cents" ? <ComparisonPrice product={product} net={field.key === "trade_price_cents"} /> : product ? val || "—" : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>
    </>
  );
}
