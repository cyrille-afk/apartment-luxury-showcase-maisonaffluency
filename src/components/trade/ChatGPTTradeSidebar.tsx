import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronDown, FolderPlus, Package, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { useProjects, type Project } from "@/hooks/useProjects";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";
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
type StagedItem = { productId: string; projectId: string; projectName: string; productName: string };
const priceKey = (brand: string, title: string) =>
  `${slugify(normalizeBrandToParent(brand))}::${slugify(title)}`;

/** A catalogue view for a narrow, self-contained trade-concierge frame. */
function TradeSidebarFeed() {
  const { user } = useAuth();
  const { currentStudio, canEdit, loading: studioLoading } = useStudio();
  const { projects, loading: projectsLoading, refresh: refreshProjects } = useProjects({ activeOnly: true });
  const navigate = useNavigate();
  const { allProducts, categories, isLoading } = useTradeProducts();
  const { showTradePrice, discountPct, tierLabel } = useTradePriceMode();
  const caps = useBrandDiscountCaps();
  const [currency] = useTradeDisplayCurrency();
  const fxRates = useFxRates();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<TradeProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const storageKey = `ma:trade-sidebar-staged:${user?.id ?? "guest"}:${currentStudio?.id ?? "solo"}`;
  const [staged, setStaged] = useState<StagedItem[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
      setStaged(Array.isArray(saved) ? saved : []);
    } catch { setStaged([]); }
  }, [storageKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const recordStaged = (entry: StagedItem) => {
    setStaged((previous) => {
      const next = previous.some((item) => item.productId === entry.productId && item.projectId === entry.projectId)
        ? previous : [...previous, entry];
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* session storage unavailable */ }
      return next;
    });
  };

  const resolveProductId = async (product: TradeProduct) => {
    if (product.trade_product_id) return product.trade_product_id;
    const { data, error } = await supabase.from("trade_products")
      .select("id").eq("source_pick_id", product.id).limit(1).maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  };

  const stageToProject = async (project: Project) => {
    if (!selectedProduct || !user || saving || !canEdit) return;
    setSaving(true);
    try {
      const productId = await resolveProductId(selectedProduct);
      if (!productId) throw new Error("This piece cannot be staged until it is in the trade catalogue.");
      const { data: existing, error: boardError } = await supabase.from("client_boards")
        .select("id").eq("project_id", project.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (boardError) throw boardError;
      let boardId = existing?.id;
      if (!boardId) {
        const created = await supabase.from("client_boards").insert({
          user_id: user.id, studio_id: currentStudio?.id ?? null, project_id: project.id,
          title: `${project.name} — Selection`, client_name: project.client_name || "",
          studio_name: currentStudio?.display_name?.trim() || currentStudio?.name || null,
          studio_logo_url: currentStudio?.logo_url ?? null, hide_maison_branding: true,
        } as never).select("id").single();
        if (created.error || !created.data) throw created.error || new Error("Could not create a project folder.");
        boardId = created.data.id;
      }
      const { data: duplicate, error: duplicateError } = await supabase.from("client_board_items")
        .select("id").eq("board_id", boardId).eq("product_id", productId).limit(1).maybeSingle();
      if (duplicateError) throw duplicateError;
      if (!duplicate) {
        const { error } = await supabase.from("client_board_items").insert({ board_id: boardId, product_id: productId } as never);
        if (error) throw error;
      }
      recordStaged({ productId, projectId: project.id, projectName: project.name, productName: selectedProduct.product_name });
      setNotice(`Success: ${selectedProduct.product_name} added to ${project.name}`);
      setSelectedProduct(null);
      setCreating(false);
      window.dispatchEvent(new Event("concierge:artifacts-changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not stage this piece.");
    } finally { setSaving(false); }
  };

  const createAndStage = async () => {
    if (!user || !newProjectName.trim() || saving || !canEdit) return;
    setSaving(true);
    const { data, error } = await supabase.from("projects").insert({
      user_id: user.id, studio_id: currentStudio?.id ?? null, name: newProjectName.trim(),
      client_name: "", location: "", status: "active",
    }).select("*").single();
    setSaving(false);
    if (error || !data) { toast.error(error?.message || "Could not create the project."); return; }
    await refreshProjects();
    window.dispatchEvent(new Event("trade-projects:changed"));
    setNewProjectName("");
    await stageToProject(data as Project);
  };

  const reviewProject = async (projectId: string) => {
    if (!user || saving || !canEdit) return;
    const items = staged.filter((item) => item.projectId === projectId);
    if (!items.length) return;
    setSaving(true);
    try {
      const { data: quote, error } = await supabase.from("trade_quotes").insert({
        user_id: user.id, studio_id: currentStudio?.id ?? null, project_id: projectId,
        status: "draft", client_name: projects.find((p) => p.id === projectId)?.client_name || "",
      } as never).select("id").single();
      if (error || !quote) throw error || new Error("Could not create a draft quote.");
      const { error: itemError } = await supabase.from("trade_quote_items").insert(
        items.map((item) => ({ quote_id: quote.id, product_id: item.productId, quantity: 1 })) as never,
      );
      if (itemError) {
        await supabase.from("trade_quotes").delete().eq("id", quote.id);
        throw itemError;
      }
      const remaining = staged.filter((item) => item.projectId !== projectId);
      setStaged(remaining);
      try { sessionStorage.setItem(storageKey, JSON.stringify(remaining)); } catch { /* session storage unavailable */ }
      setReviewOpen(false);
      navigate(`/trade/quotes?project=${projectId}&quote=${quote.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare the quote.");
    } finally { setSaving(false); }
  };

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
    return `${showTradePrice ? `${tierLabel} ` : ""}${price.prefix ? `${price.prefix} ` : ""}${amount}`;
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

export default function ChatGPTTradeSidebar() {
  const { user, loading, rolesLoaded, isAdmin, isTradeUser } = useAuth();
  const location = useLocation();
  if (loading || !rolesLoaded) return <div className="flex h-screen items-center justify-center bg-[hsl(var(--trade-gallery-bg))]"><DotCircleLoader size="md" /></div>;
  if (!user) return <Navigate to={`/trade/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!isAdmin && !isTradeUser) return <Navigate to="/trade/me?restricted=1" replace />;
  return <TradeSidebarFeed />;
}