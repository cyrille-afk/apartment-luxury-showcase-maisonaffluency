import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, Link } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Loader2, Search, Save, FileBox, Eye, Download, X, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CloudUpload from "@/components/trade/CloudUpload";

type Format = "dwg" | "dxf" | "3ds" | "skp" | "rfa" | "obj" | "fbx" | "step" | "iges";
const FORMATS: Format[] = ["dwg", "dxf", "3ds", "skp", "rfa", "obj", "fbx", "step", "iges"];

interface CadAsset {
  id: string;
  product_id: string;
  variant_label: string | null;
  file_url: string;
  file_format: string;
  file_size_bytes: number | null;
  version: string | null;
  is_active: boolean;
  created_at: string;
}

interface ProductLite {
  id: string;
  product_name: string;
  brand_name: string | null;
}

interface CadAssetWithProduct extends CadAsset {
  product?: ProductLite | null;
}

const TradeAdminCadAssets = () => {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [assets, setAssets] = useState<CadAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [allAssets, setAllAssets] = useState<CadAssetWithProduct[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [previewAsset, setPreviewAsset] = useState<CadAssetWithProduct | null>(null);

  const loadAllAssets = async () => {
    setLoadingAll(true);
    const { data: rows } = await supabase
      .from("trade_product_cad_assets")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (rows as CadAsset[]) || [];
    const ids = Array.from(new Set(list.map((a) => a.product_id)));
    let productMap = new Map<string, ProductLite>();
    if (ids.length > 0) {
      const { data: prods } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name")
        .in("id", ids);
      for (const p of (prods as ProductLite[]) || []) productMap.set(p.id, p);
    }
    setAllAssets(list.map((a) => ({ ...a, product: productMap.get(a.product_id) || null })));
    setLoadingAll(false);
  };

  useEffect(() => { loadAllAssets(); }, []);

  // Add-form state
  const [variantLabel, setVariantLabel] = useState("");
  const [version, setVersion] = useState("");
  const [format, setFormat] = useState<Format>("dwg");
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingSize, setPendingSize] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Search products
  useEffect(() => {
    let cancelled = false;
    const q = search.trim();
    if (q.length < 2) { setProducts([]); return; }
    (async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name")
        .or(`product_name.ilike.%${q}%,brand_name.ilike.%${q}%`)
        .eq("is_active", true)
        .limit(25);
      if (!cancelled) setProducts((data as ProductLite[]) || []);
    })();
    return () => { cancelled = true; };
  }, [search]);

  const loadAssets = async (pid: string) => {
    setLoadingAssets(true);
    const { data } = await supabase
      .from("trade_product_cad_assets")
      .select("*")
      .eq("product_id", pid)
      .order("variant_label", { ascending: true, nullsFirst: true })
      .order("file_format", { ascending: true });
    setAssets((data as CadAsset[]) || []);
    setLoadingAssets(false);
  };

  useEffect(() => {
    if (productId) loadAssets(productId);
    else setAssets([]);
  }, [productId]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) || null,
    [products, productId]
  );

  const handleUploaded = (urls: string[]) => {
    if (urls[0]) {
      setPendingUrl(urls[0]);
      // Try to infer format from extension
      const ext = urls[0].split(".").pop()?.toLowerCase() as Format | undefined;
      if (ext && FORMATS.includes(ext)) setFormat(ext);
    }
  };

  const handleAdd = async () => {
    if (!productId || !pendingUrl) return;
    setSaving(true);
    const { error } = await supabase.from("trade_product_cad_assets").insert({
      product_id: productId,
      variant_label: variantLabel.trim() || null,
      file_url: pendingUrl,
      file_format: format,
      file_size_bytes: pendingSize,
      version: version.trim() || null,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Failed to add asset", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "CAD asset added" });
    setVariantLabel("");
    setVersion("");
    setPendingUrl(null);
    setPendingSize(null);
    loadAssets(productId);
    loadAllAssets();
  };

  const handleToggleActive = async (asset: CadAsset) => {
    const { error } = await supabase
      .from("trade_product_cad_assets")
      .update({ is_active: !asset.is_active })
      .eq("id", asset.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    if (productId) loadAssets(productId);
    loadAllAssets();
  };

  const handleDelete = async (asset: CadAsset) => {
    if (!confirm("Delete this CAD asset? This cannot be undone.")) return;
    const { error } = await supabase
      .from("trade_product_cad_assets")
      .delete()
      .eq("id", asset.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Asset deleted" });
    if (productId) loadAssets(productId);
    loadAllAssets();
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  // Group assets by variant_label
  const groups = new Map<string, CadAsset[]>();
  for (const a of assets) {
    const key = a.variant_label || "__default__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  return (
    <>
      <Helmet><title>CAD &amp; 3D Assets — Admin — Maison Affluency</title></Helmet>
      <div className="max-w-5xl space-y-6">
        <Link to="/trade/admin" className="inline-flex items-center gap-1 font-body text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Admin
        </Link>

        <header>
          <div className="flex items-center gap-2 mb-1">
            <FileBox className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl text-foreground">CAD &amp; 3D Assets</h1>
          </div>
          <p className="font-body text-xs text-muted-foreground">
            Upload .dwg, .rfa, .skp, .obj and other CAD/3D files per product, optionally per variant (size, finish, configuration). Trade users see active assets on the product spec sheet.
          </p>
        </header>

        {/* All assets table */}
        <section className="border border-border rounded-md p-4 bg-card/40 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display text-sm text-foreground">All uploaded assets ({allAssets.length})</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Filter by product, brand, variant, format…"
                className="w-72 max-w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/30"
              />
            </div>
          </div>
          {loadingAll ? (
            <p className="font-body text-xs text-muted-foreground">Loading…</p>
          ) : allAssets.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground">No CAD/3D files have been uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left">
                <thead className="bg-muted/40">
                  <tr className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Variant</th>
                    <th className="px-3 py-2 font-medium">Format</th>
                    <th className="px-3 py-2 font-medium">Version</th>
                    <th className="px-3 py-2 font-medium">File</th>
                    <th className="px-3 py-2 font-medium text-center">Active</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {allAssets
                    .filter((a) => {
                      const q = globalFilter.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        (a.product?.product_name || "").toLowerCase().includes(q) ||
                        (a.product?.brand_name || "").toLowerCase().includes(q) ||
                        (a.variant_label || "").toLowerCase().includes(q) ||
                        a.file_format.toLowerCase().includes(q) ||
                        (a.version || "").toLowerCase().includes(q)
                      );
                    })
                    .map((a) => (
                      <tr key={a.id} className="font-body text-xs text-foreground bg-background hover:bg-muted/20">
                        <td className="px-3 py-2 min-w-[180px]">
                          <button
                            type="button"
                            onClick={() => setProductId(a.product_id)}
                            className="text-left hover:underline"
                            title="Select this product"
                          >
                            <div className="truncate max-w-[240px]">{a.product?.product_name || <span className="text-muted-foreground italic">Unknown product</span>}</div>
                            {a.product?.brand_name && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[240px]">{a.product.brand_name}</div>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {a.variant_label || <span className="italic">Default</span>}
                        </td>
                        <td className="px-3 py-2 uppercase tracking-wider">.{a.file_format}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.version || "—"}</td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <a
                            href={a.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-muted-foreground hover:text-foreground truncate block"
                          >
                            {a.file_url.split("/").pop()}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={a.is_active}
                              onChange={() => handleToggleActive(a)}
                              className="h-3.5 w-3.5 accent-primary"
                            />
                          </label>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(a)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Product picker */}
        <section className="border border-border rounded-md p-4 bg-card/40 space-y-3">
          <label className="block font-body text-xs uppercase tracking-[0.18em] text-muted-foreground">Product</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product or brand…"
              className="w-full pl-8 pr-3 py-2 rounded-md border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/30"
            />
          </div>
          {products.length > 0 && (
            <ul className="max-h-56 overflow-auto rounded-md border border-border/60 divide-y divide-border/60">
              {products.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { setProductId(p.id); setSearch(""); setProducts([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-muted/40 flex items-center justify-between gap-2"
                  >
                    <span className="font-body text-xs text-foreground truncate">{p.product_name}</span>
                    <span className="font-body text-[10px] text-muted-foreground shrink-0">{p.brand_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedProduct && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
              <div className="min-w-0">
                <p className="font-display text-sm text-foreground truncate">{selectedProduct.product_name}</p>
                <p className="font-body text-[10px] text-muted-foreground truncate">{selectedProduct.brand_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setProductId(null)}
                className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
              >
                Change
              </button>
            </div>
          )}
        </section>

        {productId && (
          <>
            {/* Add new asset */}
            <section className="border border-border rounded-md p-4 bg-card/40 space-y-3">
              <h2 className="font-display text-sm text-foreground flex items-center gap-2">
                <Plus className="h-3.5 w-3.5 text-primary" /> Add CAD / 3D File
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Variant label (optional)</label>
                  <input
                    type="text"
                    value={variantLabel}
                    onChange={(e) => setVariantLabel(e.target.value)}
                    placeholder="e.g. 200 cm — Walnut"
                    className="w-full px-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="block font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as Format)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground"
                  >
                    {FORMATS.map((f) => (
                      <option key={f} value={f}>.{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Version (optional)</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="e.g. v2024.1"
                    className="w-full px-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <CloudUpload
                  folder="cad-assets"
                  accept=".dwg,.dxf,.3ds,.skp,.rfa,.obj,.fbx,.step,.stp,.iges,.igs,application/octet-stream"
                  maxSizeMB={100}
                  label={pendingUrl ? "Replace file" : "Upload CAD/3D file"}
                  onUpload={handleUploaded}
                />
                {pendingUrl && (
                  <span className="font-body text-[10px] text-muted-foreground truncate max-w-[280px]">
                    Ready: {pendingUrl.split("/").pop()}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!pendingUrl || saving}
                  onClick={handleAdd}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-body text-xs disabled:opacity-50 disabled:pointer-events-none hover:bg-primary/90 transition-colors"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save asset
                </button>
              </div>
            </section>

            {/* Existing assets */}
            <section className="border border-border rounded-md p-4 bg-card/40">
              <h2 className="font-display text-sm text-foreground mb-3">Existing assets ({assets.length})</h2>
              {loadingAssets ? (
                <p className="font-body text-xs text-muted-foreground">Loading…</p>
              ) : assets.length === 0 ? (
                <p className="font-body text-xs text-muted-foreground">No CAD/3D files yet.</p>
              ) : (
                <div className="space-y-4">
                  {Array.from(groups.entries()).map(([variant, list]) => (
                    <div key={variant}>
                      <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                        {variant === "__default__" ? "Default (all variants)" : variant}
                      </p>
                      <ul className="divide-y divide-border/60 rounded-md border border-border/60 overflow-hidden">
                        {list.map((a) => (
                          <li key={a.id} className="flex items-center gap-3 px-3 py-2 bg-background">
                            <span className="font-body text-xs text-foreground uppercase tracking-wider w-14 shrink-0">.{a.file_format}</span>
                            {a.version && (
                              <span className="font-body text-[10px] text-muted-foreground shrink-0">{a.version}</span>
                            )}
                            <a
                              href={a.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-body text-[11px] text-muted-foreground truncate hover:text-foreground min-w-0 flex-1"
                            >
                              {a.file_url.split("/").pop()}
                            </a>
                            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={a.is_active}
                                onChange={() => handleToggleActive(a)}
                                className="h-3 w-3 accent-primary"
                              />
                              <span className="font-body text-[10px] text-muted-foreground">Active</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDelete(a)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
};

export default TradeAdminCadAssets;
