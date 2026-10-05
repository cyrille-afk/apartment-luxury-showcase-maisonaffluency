import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronDown, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { useBrandDiscountCaps, effectiveDiscountForBrand } from "@/lib/brandDiscountCap";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import { formatPriceConverted, useFxRates } from "@/components/trade/CurrencyToggle";
import { normalizeBrandToParent } from "@/lib/brandNormalization";
import { supabase } from "@/integrations/supabase/client";
import type { TradeProduct } from "@/lib/tradeProducts";

const slugify = (value: string) => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Price = { cents: number; currency: string; prefix: string | null };
const priceKey = (brand: string, title: string) =>
  `${slugify(normalizeBrandToParent(brand))}::${slugify(title)}`;

/** A catalogue view for a narrow, self-contained trade-concierge frame. */
export default function ChatGPTTradeSidebar() {
  const { allProducts, categories, isLoading } = useTradeProducts();
  const { discountPct } = useTradeDiscount();
  const { showTradePrice } = useTradePriceMode();
  const caps = useBrandDiscountCaps();
  const [currency] = useTradeDisplayCurrency();
  const fxRates = useFxRates();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Only manually reviewed Designer Editor prices are eligible for this feed.
  // Never fall back to the potentially unreviewed trade_products price column.
  const { data: catalogue, isPending: pricesPending } = useQuery({
    queryKey: ["trade-sidebar-reviewed-prices"],
    queryFn: async () => {
      const [picks, designers] = await Promise.all([
        supabase.from("designer_curator_picks")
          .select("id, title, trade_price_cents, currency, price_prefix, size_variants, designers(name)")
          .eq("is_hidden", false),
        supabase.from("designers").select("name, display_name, slug").eq("is_published", true),
      ]);
      if (picks.error) throw picks.error;
      if (designers.error) throw designers.error;
      const byId = new Map<string, Price>();
      const byKey = new Map<string, Price>();
      for (const pick of picks.data ?? []) {
        const designer = Array.isArray(pick.designers) ? pick.designers[0] : pick.designers;
        const variants = Array.isArray(pick.size_variants) ? pick.size_variants as Array<{ price_cents?: number }> : [];
        const prices = variants.map((v) => Number(v?.price_cents)).filter((n) => Number.isFinite(n) && n > 0);
        const cents = Number(pick.trade_price_cents) > 0 ? Number(pick.trade_price_cents) : prices.length ? Math.min(...prices) : 0;
        if (!cents || !designer?.name) continue;
        const price = { cents, currency: pick.currency || "EUR", prefix: pick.price_prefix || (prices.length > 1 ? "From" : null) };
        byId.set(pick.id, price);
        byKey.set(priceKey(designer.name, pick.title), price);
      }
      const slugs = new Map<string, string>();
      for (const designer of designers.data ?? []) {
        slugs.set(slugify(designer.name), designer.slug);
        if (designer.display_name) slugs.set(slugify(designer.display_name), designer.slug);
      }
      return { byId, byKey, slugs };
    },
    staleTime: 60_000,
  });

  const products = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return allProducts.filter((item) =>
      (category === "all" || item.category === category) &&
      (!term || [item.product_name, item.brand_name, item.materials, item.subtitle]
        .some((field) => field?.toLocaleLowerCase().includes(term))),
    );
  }, [allProducts, search, category]);

  const productUrl = (product: TradeProduct) => {
    if (product.trade_product_id) return `/trade/products/${product.trade_product_id}`;
    const brand = product.brand_name.includes(" - ") ? product.brand_name.split(" - ")[0] : product.brand_name;
    const designerSlug = catalogue?.slugs.get(slugify(brand)) || slugify(brand);
    return `/trade/products/${designerSlug}/${slugify(product.product_name)}`;
  };

  const priceLabel = (product: TradeProduct) => {
    if (!catalogue) return pricesPending ? "Loading price…" : "Price upon Request";
    const price = catalogue.byId.get(product.id) || catalogue.byKey.get(priceKey(product.brand_name, product.product_name));
    if (!price) return "Price upon Request";
    const fraction = showTradePrice ? effectiveDiscountForBrand(discountPct, product.brand_name, caps).pct : 0;
    const cents = Math.round(price.cents * (1 - fraction));
    const amount = formatPriceConverted(cents, price.currency, currency, fxRates);
    return `${showTradePrice ? "Trade " : ""}${price.prefix ? `${price.prefix} ` : ""}${amount}`;
  };

  return (
    <div className="h-screen h-[100dvh] w-full max-w-[400px] min-w-0 flex flex-col overflow-hidden bg-[hsl(var(--trade-gallery-bg))] text-foreground" aria-label="Trade product sidebar">
      <Helmet><title>Trade Concierge Collection | Maison Affluency</title></Helmet>
      <header className="sticky top-0 z-10 shrink-0 border-t border-b border-border bg-[hsl(var(--trade-gallery-bg))] px-5 pt-5 pb-4">
        <div className="font-display text-[21px] leading-none text-foreground">Maison Affluency</div>
        <div className="mt-2 font-body text-[9px] uppercase text-muted-foreground">Trade Concierge</div>
        <div className="mt-6 flex items-center gap-3 border-b border-border pb-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            aria-label="Search trade products"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the collection"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-body text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Filter by Category"
            aria-expanded={filtersOpen}
            title="Filter by Category"
            onClick={() => setFiltersOpen((open) => !open)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`size-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </Button>
        </div>
        {filtersOpen && (
          <div className="pt-3">
            <label htmlFor="chatgpt-trade-category" className="font-body text-[10px] uppercase text-muted-foreground">Filter by Category</label>
            <select
              id="chatgpt-trade-category"
              value={category}
              onChange={(event) => { setCategory(event.target.value); setFiltersOpen(false); }}
              className="mt-1.5 w-full border-b border-border bg-transparent py-2 font-body text-sm text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Categories</option>
              {categories.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        )}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide px-4 pb-8 pt-5" aria-live="polite">
        {isLoading ? <div className="flex justify-center py-16"><DotCircleLoader size="md" /></div> : products.length === 0 ? (
          <p className="py-12 text-center font-body text-sm text-muted-foreground">No pieces found.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {products.map((product) => (
              <Link key={`${product.brand_name}-${product.product_name}-${product.id}`} to={productUrl(product)} state={{ from: location.pathname }} className="group block min-w-0 bg-card p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex aspect-[5/4] w-full items-center justify-center overflow-hidden bg-[hsl(var(--product-canvas))]">
                  {product.image_url ? <img src={product.image_url} alt={product.product_name} loading="lazy" decoding="async" className="h-full w-full object-contain object-center p-3 transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none" /> : <Package className="size-6 text-muted-foreground/50" aria-hidden="true" />}
                </div>
                <div className="flex min-w-0 items-start justify-between gap-3 px-1 pt-3 pb-1">
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[10px] uppercase leading-snug text-muted-foreground">{product.brand_name}</p>
                    <h2 className="mt-1 font-display text-[15px] leading-snug text-foreground break-words">{product.product_name}</h2>
                  </div>
                  <span data-trade-sensitive={showTradePrice ? "" : undefined} className="max-w-[43%] shrink-0 pt-0.5 text-right font-body text-[10px] uppercase leading-snug text-muted-foreground break-words">{priceLabel(product)}</span>
                  {showTradePrice && <span data-client-placeholder aria-hidden="true" className="hidden h-3 w-16 bg-muted/60" />}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}