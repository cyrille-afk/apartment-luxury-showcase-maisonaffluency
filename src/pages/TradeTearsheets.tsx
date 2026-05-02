import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useRef, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Loader2, Search, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { normalizeCategory, normalizeSubcategory, CATEGORY_ORDER, getSubcategoriesForCategory } from "@/lib/productTaxonomy";
import { ProjectPicker } from "@/components/trade/ProjectPicker";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";

interface TearsheetProduct {
  id: string;
  product_name: string;
  brand_name: string;
  parent_brand: string;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  dimensions: string | null;
  materials: string | null;
  description: string | null;
  lead_time: string | null;
  trade_price_cents: number | null;
  currency: string;
  source: "curator" | "trade";
}

export default function TradeTearsheets() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterDesigner, setFilterDesigner] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSubcategory, setFilterSubcategory] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const filterProjectId = searchParams.get("project");
  const setFilterProjectId = (id: string | null) => {
    try {
      if (id) sessionStorage.setItem("trade:lastProjectFilter", id);
      else sessionStorage.removeItem("trade:lastProjectFilter");
    } catch {}
    const next = new URLSearchParams(searchParams);
    if (id) next.set("project", id); else next.delete("project");
    // Push so browser back/forward restores prior filter state.
    setSearchParams(next);
  };
  // On first mount: if no URL param, hydrate from sessionStorage (replace, no history entry).
  useEffect(() => {
    if (filterProjectId) {
      try { sessionStorage.setItem("trade:lastProjectFilter", filterProjectId); } catch {}
      return;
    }
    let stored: string | null = null;
    try { stored = sessionStorage.getItem("trade:lastProjectFilter"); } catch {}
    if (stored) {
      const next = new URLSearchParams(searchParams);
      next.set("project", stored);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Keep storage in sync with URL on subsequent navigations (back/forward included).
  useEffect(() => {
    try {
      if (filterProjectId) sessionStorage.setItem("trade:lastProjectFilter", filterProjectId);
    } catch {}
  }, [filterProjectId]);
  const [selectedProduct, setSelectedProduct] = useState<TearsheetProduct | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch the set of product IDs (from quotes + boards) belonging to the selected project
  const { data: projectProductIds } = useQuery({
    queryKey: ["tearsheet-project-product-ids", filterProjectId, user?.id],
    enabled: !!filterProjectId && !!user,
    queryFn: async () => {
      const ids = new Set<string>();
      const [quotesRes, boardsRes] = await Promise.all([
        supabase.from("trade_quotes").select("id").eq("project_id", filterProjectId!),
        supabase.from("client_boards").select("id").eq("project_id", filterProjectId!),
      ]);
      const quoteIds = (quotesRes.data || []).map((q: any) => q.id);
      const boardIds = (boardsRes.data || []).map((b: any) => b.id);
      const [qItems, bItems] = await Promise.all([
        quoteIds.length
          ? supabase.from("trade_quote_items").select("product_id").in("quote_id", quoteIds)
          : Promise.resolve({ data: [] as any[] }),
        boardIds.length
          ? supabase.from("client_board_items").select("product_id").in("board_id", boardIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      (qItems.data || []).forEach((r: any) => r.product_id && ids.add(r.product_id));
      (bItems.data || []).forEach((r: any) => r.product_id && ids.add(r.product_id));
      return ids;
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["tearsheet-products-merged"],
    queryFn: async () => {
      // Fetch curator picks, trade_products, and all designers for parent mapping
      const [curatorRes, tradeRes, designerRes] = await Promise.all([
        supabase
          .from("designer_curator_picks")
          .select("id, title, designer_id, category, subcategory, image_url, dimensions, materials, description, trade_price_cents, currency, designers!inner(name, founder)")
          .order("title"),
        supabase
          .from("trade_products")
          .select("id, product_name, brand_name, category, subcategory, image_url, dimensions, materials, description, lead_time, trade_price_cents, currency")
          .eq("is_active", true)
          .not("image_url", "is", null)
          .neq("image_url", "")
          .order("brand_name")
          .order("product_name"),
        supabase
          .from("designers")
          .select("name, founder")
          .not("founder", "is", null),
      ]);

      // Build a lookup: child designer name → parent brand
      const childToParent = new Map<string, string>();
      (designerRes.data || []).forEach((d: any) => {
        if (d.founder && d.founder !== d.name) {
          childToParent.set(d.name.toLowerCase(), d.founder);
        }
      });

      const seen = new Map<string, boolean>();
      const merged: TearsheetProduct[] = [];

      // Add curator picks — display child designer name, group under parent brand
      (curatorRes.data || []).forEach((p: any) => {
        const designer = p.designers as any;
        const designerName = designer?.name || "Unknown";
        const founder = designer?.founder;
        const isChild = founder && founder !== designerName;
        // Display name keeps the child designer, parent_brand is used for filtering/grouping
        const displayName = designerName;
        const parentBrand = isChild ? founder : designerName;
        // Dedup key uses parent brand to avoid duplicates across parent/child
        const key = `${parentBrand.toLowerCase()}::${p.title.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.set(key, true);
        merged.push({
          id: p.id,
          product_name: p.title,
          brand_name: displayName,
          parent_brand: parentBrand,
          category: normalizeCategory(p.category, p.subcategory) || null,
          subcategory: normalizeSubcategory(p.subcategory) || null,
          image_url: p.image_url,
          dimensions: p.dimensions,
          materials: p.materials,
          description: p.description,
          lead_time: null,
          trade_price_cents: p.trade_price_cents || null,
          currency: p.currency || "EUR",
          source: "curator",
        });
      });

      // Add trade products that aren't already covered
      (tradeRes.data || []).forEach((p: any) => {
        // Resolve parent brand from child→parent map
        const resolvedParent = childToParent.get(p.brand_name.toLowerCase()) || p.brand_name;
        const key = `${resolvedParent.toLowerCase()}::${p.product_name.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.set(key, true);
        merged.push({
          id: p.id,
          product_name: p.product_name,
          brand_name: p.brand_name,
          parent_brand: resolvedParent,
          category: normalizeCategory(p.category, p.subcategory) || null,
          subcategory: normalizeSubcategory(p.subcategory) || null,
          image_url: p.image_url,
          dimensions: p.dimensions,
          materials: p.materials,
          description: p.description,
          lead_time: p.lead_time,
          trade_price_cents: p.trade_price_cents || null,
          currency: p.currency || "EUR",
          source: "trade",
        });
      });

      // Sort by brand then product name
      merged.sort((a, b) => a.brand_name.localeCompare(b.brand_name) || a.product_name.localeCompare(b.product_name));
      return merged;
    },
  });

  // Derive unique values for filter dropdowns using taxonomy order
  const designers = useMemo(() => [...new Set(products.map((p) => p.parent_brand))].sort(), [products]);
  const categories = useMemo(() => {
    const raw = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
    return CATEGORY_ORDER.filter((c) => raw.includes(c));
  }, [products]);
  const subcategories = useMemo(() => {
    if (!filterCategory) return [];
    const taxonomySubs = getSubcategoriesForCategory(filterCategory);
    const dataSubs = [...new Set(
      products.filter((p) => p.category === filterCategory).map((p) => p.subcategory).filter(Boolean)
    )] as string[];
    // Return taxonomy-ordered subs that exist in data
    const ordered = taxonomySubs.filter((s) => dataSubs.includes(s));
    // Add any data subs not in taxonomy
    dataSubs.forEach((s) => { if (!ordered.includes(s)) ordered.push(s); });
    return ordered;
  }, [products, filterCategory]);

  const filtered = products.filter((p) => {
    if (search && ![p.product_name, p.brand_name].some((f) => f?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterDesigner && p.parent_brand !== filterDesigner) return false;
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterSubcategory && p.subcategory !== filterSubcategory) return false;
    if (filterProjectId && projectProductIds && !projectProductIds.has(p.id)) return false;
    return true;
  });

  const handlePrint = () => {
    if (!printRef.current || !selectedProduct) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Tearsheet - ${selectedProduct.product_name}</title>
      <style>
        body { font-family: 'Helvetica Neue', sans-serif; margin: 40px; color: #1a1a1a; }
        .header { border-bottom: 1px solid #e5e5e5; padding-bottom: 16px; margin-bottom: 24px; }
        .brand { font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #666; }
        .name { font-size: 24px; margin: 4px 0 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 2px; }
        .value { font-size: 14px; }
        .img { max-width: 100%; max-height: 300px; object-fit: contain; border: 1px solid #eee; }
        .footer { margin-top: 40px; border-top: 1px solid #e5e5e5; padding-top: 16px; font-size: 10px; color: #999; }
      </style></head><body>
      <div class="header">
        <p class="brand">${selectedProduct.brand_name}</p>
        <h1 class="name">${selectedProduct.product_name}</h1>
      </div>
      ${selectedProduct.image_url ? `<img class="img" src="${selectedProduct.image_url}" />` : ""}
      <div class="grid" style="margin-top:24px">
        <div><p class="label">Category</p><p class="value">${selectedProduct.category || "—"}</p></div>
        <div><p class="label">Dimensions</p><p class="value">${selectedProduct.dimensions || "—"}</p></div>
        <div><p class="label">Materials</p><p class="value">${selectedProduct.materials || "—"}</p></div>
        <div><p class="label">Lead Time</p><p class="value">${selectedProduct.lead_time || "—"}</p></div>
        <div><p class="label">Trade Price</p><p class="value">${selectedProduct.trade_price_cents
          ? `${selectedProduct.currency === "USD" ? "$" : selectedProduct.currency === "GBP" ? "£" : selectedProduct.currency === "SGD" ? "S$" : "€"}${(selectedProduct.trade_price_cents / 100).toLocaleString()}`
          : "Price on Request"}</p></div>
        ${selectedProduct.description ? `<div style="grid-column:1/3"><p class="label">Description</p><p class="value">${selectedProduct.description}</p></div>` : ""}
      </div>
      <div class="footer">
        <p>Generated by Maison Affluency Trade Portal · ${new Date().toLocaleDateString()}</p>
      </div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <>
      <Helmet><title>Tearsheet Builder — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <TradeBreadcrumb current="Tearsheets" currentProjectTab="tearsheets" />
        <div>
          <h1 className="font-display text-2xl text-foreground">Tearsheet Builder</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Generate one-click product tearsheets with specs, dimensions, and pricing for client handoff.
          </p>
        </div>

        {selectedProduct ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>← Back to products</Button>
              <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print Tearsheet</Button>
            </div>
            <div ref={printRef} className="border border-border rounded-lg p-6 space-y-6">
              <div className="border-b border-border pb-4">
                <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{selectedProduct.brand_name}</p>
                <h2 className="font-display text-xl text-foreground mt-1">{selectedProduct.product_name}</h2>
              </div>
              {selectedProduct.image_url && (
                <img src={selectedProduct.image_url} alt={selectedProduct.product_name} className="max-h-72 object-contain border border-border rounded" />
              )}
              <div className="grid grid-cols-2 gap-4">
                {([
                  ["Category", selectedProduct.category],
                  ["Dimensions", selectedProduct.dimensions],
                  ["Materials", selectedProduct.materials],
                  ["Lead Time", selectedProduct.lead_time],
                  ["Trade Price", selectedProduct.trade_price_cents
                    ? `${selectedProduct.currency === "USD" ? "$" : selectedProduct.currency === "GBP" ? "£" : selectedProduct.currency === "SGD" ? "S$" : "€"}${(selectedProduct.trade_price_cents / 100).toLocaleString()}`
                    : "Price on Request"],
                ] as const).map(([label, val]) => (
                  <div key={label}>
                    <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="font-body text-sm text-foreground mt-0.5">{val || "—"}</p>
                  </div>
                ))}
              </div>
              {selectedProduct.description && (
                <div>
                  <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Description</p>
                  <p className="font-body text-sm text-muted-foreground mt-1">{selectedProduct.description}</p>
                </div>
              )}
              <div className="border-t border-border pt-4">
                <p className="font-body text-[10px] text-muted-foreground">Generated by Maison Affluency Trade Portal · {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10 font-body text-sm" />
              </div>
              <select
                value={filterDesigner}
                onChange={(e) => setFilterDesigner(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 font-body text-sm text-foreground"
              >
                <option value="">All Designers</option>
                {designers.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setFilterSubcategory(""); }}
                className="h-9 rounded-md border border-input bg-background px-3 font-body text-sm text-foreground"
              >
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {subcategories.length > 0 && (
                <select
                  value={filterSubcategory}
                  onChange={(e) => setFilterSubcategory(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 font-body text-sm text-foreground"
                >
                  <option value="">All Subcategories</option>
                  {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <ProjectPicker value={filterProjectId} onChange={setFilterProjectId} compact />
              {(filterDesigner || filterCategory || filterSubcategory || filterProjectId) && (
                <button
                  onClick={() => { setFilterDesigner(""); setFilterCategory(""); setFilterSubcategory(""); setFilterProjectId(null); }}
                  className="font-body text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
            {filterProjectId && (
              <p className="font-body text-[11px] text-muted-foreground -mt-1">
                Showing only products from this project's quotes and boards.
              </p>
            )}
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border rounded-lg">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-body text-sm text-muted-foreground">No products found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className="group flex items-start gap-3 p-4 rounded-lg border border-border hover:border-foreground/30 bg-card text-left transition-all hover:shadow-sm"
                  >
                    <div className="w-16 h-16 rounded bg-muted overflow-hidden shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><FileText className="h-5 w-5 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm text-foreground truncate">{p.product_name}</p>
                      <p className="font-body text-[11px] text-muted-foreground">{p.brand_name}</p>
                      <p className="font-body text-[10px] text-muted-foreground/70 mt-1 capitalize">{p.category || "—"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
