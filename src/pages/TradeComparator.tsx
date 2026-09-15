import { Helmet } from "react-helmet-async";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Search, X, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";

export default function TradeComparator() {
  const [search, setSearch] = useState("");
  const [compareList, setCompareList] = useState<any[]>([]);
  const { showTradePrice } = useTradePriceMode();

  // Load only the user's favourited products
  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["comparator-favorites"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("trade_favorites")
        .select("id, product_id, trade_products(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data || [])
        .filter((f: any) => f.trade_products)
        .map((f: any) => ({ ...f.trade_products, favorite_id: f.id }));
    },
  });

  const filtered = favorites.filter((p: any) =>
    !search || [p.product_name, p.brand_name].some((f: string) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCompare = (p: any) => {
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
    { key: "rrp_price_cents", label: "RRP", format: (v: number | null) => v ? `€${(v / 100).toFixed(2)}` : "—" },
    ...(showTradePrice
      ? [{ key: "trade_price_cents", label: "Trade Price", format: (v: number | null) => v ? `€${(v / 100).toFixed(2)}` : "On request" }]
      : []),
  ];

  return (
    <>
      <Helmet><title>Product Comparator — Trade Portal</title></Helmet>
      <div className="mx-auto w-full max-w-6xl space-y-6 [@media(min-width:1440px)]:max-w-[min(90vw,1800px)]">
        <Breadcrumbs
          variant="compact"
          items={[
            { label: "Tools", to: "/trade/tools" },
            { label: "Product Comparator" },
          ]}
        />

        <div>
          <h1 className="font-display text-2xl text-foreground">Product Comparator</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Compare up to 4 products from your favourites side-by-side on dimensions, materials, price, and lead time.
          </p>
        </div>

        <section className="border-y border-border py-5">
          <div className="flex flex-col gap-4 [@media(min-width:1440px)]:flex-row [@media(min-width:1440px)]:items-center">
            <div className="relative w-full shrink-0 [@media(min-width:1440px)]:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your favourites..." className="pl-10 font-body text-sm" />
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

          <div className="mt-4 flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wider text-muted-foreground">
              <Heart className="h-3 w-3" />
              {compareList.length < 4
                ? `Select from your favourites (${compareList.length}/4)`
                : "Maximum 4 products"}
            </p>
          </div>

          <div className="mt-3 h-44 overflow-y-auto">
            {favorites.length === 0 && !isLoading ? (
              <p className="flex h-full items-center justify-center font-body text-sm text-muted-foreground">
                No favourites yet — save products from the Showroom to compare them here.
              </p>
            ) : isLoading ? (
              <div className="flex h-full items-center justify-center"><DotCircleLoader size="sm" className="text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 [@media(min-width:1440px)]:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                {filtered.map((p: any) => {
                  const onList = compareList.find((c) => c.id === p.id);
                  return (
                    <Button
                      key={p.id}
                      type="button"
                      variant="outline"
                      onClick={() => addToCompare(p)}
                      disabled={!!onList || compareList.length >= 4}
                      className={`h-auto min-h-16 justify-start gap-2.5 rounded-md p-3 text-left ${onList ? "border-primary bg-primary/5 opacity-60" : ""} ${compareList.length >= 4 && !onList ? "opacity-40" : ""}`}
                    >
                      <span className="h-10 w-10 shrink-0 overflow-hidden bg-muted">
                        {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body text-xs font-normal text-foreground">{p.product_name}</span>
                        <span className="block truncate font-body text-[10px] font-normal text-muted-foreground">{p.brand_name}</span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}
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
                  <tr key={field.key} className="border-b border-border/50">
                    <td className="px-4 py-2.5 font-body text-[10px] uppercase tracking-wider text-muted-foreground">{field.label}</td>
                    {comparisonSlots.map((product, index) => {
                      const val = product ? (product as any)[field.key] : null;
                      return (
                        <td key={product?.id ?? `${field.key}-${index}`} className="px-4 py-3 font-body text-sm text-foreground align-top">
                          {product ? (field.format ? field.format(val) : val || "—") : "—"}
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
