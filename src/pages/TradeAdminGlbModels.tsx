import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, Link } from "react-router-dom";
import { ChevronLeft, Search, Loader2, Trash2, ExternalLink, Box, Filter } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { GlbVariantManager } from "@/components/trade/admin/GlbVariantManager";

interface ProductRow {
  id: string;
  product_name: string;
  brand_name: string | null;
  image_url: string | null;
  glb_url: string | null;
  updated_at?: string | null;
}

type SortKey = "updated_desc" | "updated_asc" | "name_asc" | "name_desc";
const PAGE_SIZE = 24;

const MAX_MB = 50;

const TradeAdminGlbModels: React.FC = () => {
  const { isAdmin, loading } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [withGlb, setWithGlb] = useState<ProductRow[]>([]);
  const [results, setResults] = useState<ProductRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  // Manager section state
  const [managerSearch, setManagerSearch] = useState("");
  const [managerBrand, setManagerBrand] = useState<string>("");
  const [managerSort, setManagerSort] = useState<SortKey>("updated_desc");
  const [managerPage, setManagerPage] = useState(1);
  useEffect(() => { setManagerPage(1); }, [managerSearch, managerBrand, managerSort]);

  // Load products that already have a GLB (used by both sidebar and manager)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, glb_url, updated_at")
        .not("glb_url", "is", null)
        .order("updated_at", { ascending: false })
        .limit(500);
      setWithGlb((data as ProductRow[]) || []);
    })();
  }, [reloadKey]);

  // Debounced search
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const term = search.trim();
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, glb_url")
        .or(`product_name.ilike.%${term}%,brand_name.ilike.%${term}%`)
        .eq("is_active", true)
        .order("product_name", { ascending: true })
        .limit(25);
      setResults((data as ProductRow[]) || []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const handleUpload = async (files: File[]) => {
    if (!selected || files.length === 0) return;

    let fileToUpload: File | null = null;
    let ext: "glb" | "gltf" = "glb";

    // Case 1: single GLB/GLTF direct upload
    if (files.length === 1) {
      const f = files[0];
      const n = f.name.toLowerCase();
      if (n.endsWith(".glb") || n.endsWith(".gltf")) {
        fileToUpload = f;
        ext = n.endsWith(".gltf") ? "gltf" : "glb";
      }
    }

    // Case 2: OBJ (+ MTL + textures) bundle → convert to GLB
    if (!fileToUpload) {
      const bundle = classifyObjBundle(files);
      if (bundle) {
        setUploading(true);
        setUploadProgress(0);
        try {
          toast.message("Converting OBJ to GLB in your browser…");
          const outName = bundle.objFile.name.replace(/\.obj$/i, "") + ".glb";
          fileToUpload = await convertObjBundleToGlb(bundle, outName);
          ext = "glb";
        } catch (e: any) {
          setUploading(false);
          toast.error(`OBJ→GLB conversion failed: ${e?.message || e}`);
          return;
        }
      }
    }

    if (!fileToUpload) {
      toast.error("Please upload a .glb/.gltf, or an .obj (optionally with .mtl + textures).");
      return;
    }

    if (fileToUpload.size > MAX_MB * 1024 * 1024) {
      setUploading(false);
      toast.error(`${(fileToUpload.size / 1024 / 1024).toFixed(1)} MB exceeds the ${MAX_MB} MB limit.`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const contentType = ext === "glb" ? "model/gltf-binary" : "model/gltf+json";
      const path = `glb-models/${selected.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("assets")
        .upload(path, fileToUpload, {
          contentType,
          cacheControl: "31536000",
          upsert: false,
          onUploadProgress: (evt: { loaded?: number; total?: number }) => {
            const pct = Math.round(((evt.loaded || 0) / (evt.total || fileToUpload!.size)) * 100);
            setUploadProgress(pct);
          },
        } as any);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: updErr } = await supabase
        .from("trade_products")
        .update({ glb_url: publicUrl })
        .eq("id", selected.id);
      if (updErr) throw updErr;

      toast.success(`3D model saved for "${selected.product_name}"`);
      setSelected({ ...selected, glb_url: publicUrl });
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (row: ProductRow) => {
    if (!confirm(`Remove the 3D model from "${row.product_name}"?`)) return;
    const { error } = await supabase
      .from("trade_products")
      .update({ glb_url: null })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("3D model removed");
    if (selected?.id === row.id) setSelected({ ...row, glb_url: null });
    setReloadKey((k) => k + 1);
  };

  const list = useMemo(() => (search.trim() ? results : withGlb), [search, results, withGlb]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet>
        <title>3D Models · Trade Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <Link
            to="/trade/admin"
            className="inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground mb-6"
          >
            <ChevronLeft size={14} /> Back to Trade Admin
          </Link>

          <h1 className="font-display text-3xl mb-2 flex items-center gap-3">
            <Box size={22} /> 3D Models
          </h1>
          <p className="font-body text-sm text-muted-foreground mb-10 max-w-2xl">
            Upload a GLB or GLTF file and we'll attach it to the product's <code>glb_url</code>.
            The interactive 3D viewer then appears on the trade product page.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10">
            {/* LEFT: search + list */}
            <div>
              <label className="block font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
                {search.trim() ? "Search results" : "Products with a 3D model"}
              </label>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search product or brand…"
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:outline-none focus:border-foreground/40"
                />
              </div>

              <div className="border border-border rounded-md divide-y divide-border max-h-[60vh] overflow-y-auto">
                {searching && (
                  <div className="px-3 py-4 text-muted-foreground text-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Searching…
                  </div>
                )}
                {!searching && list.length === 0 && (
                  <div className="px-3 py-6 text-muted-foreground text-sm text-center">
                    {search.trim() ? "No products match." : "No products have a 3D model yet."}
                  </div>
                )}
                {list.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors ${
                      selected?.id === row.id ? "bg-muted/60" : ""
                    }`}
                  >
                    {row.image_url ? (
                      <img src={row.image_url} alt="" className="w-10 h-10 object-cover rounded border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded border border-border bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm truncate">{row.product_name}</div>
                      <div className="font-body text-[11px] text-muted-foreground truncate">{row.brand_name || "—"}</div>
                    </div>
                    {row.glb_url && (
                      <span className="font-body text-[10px] uppercase tracking-[0.12em] text-emerald-600">3D</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT: upload + preview */}
            <div>
              {!selected ? (
                <div className="border border-dashed border-border rounded-md p-10 text-center text-muted-foreground font-body text-sm">
                  Select a product on the left to upload or replace its 3D model.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="font-display text-xl">{selected.product_name}</div>
                    <div className="font-body text-xs text-muted-foreground">{selected.brand_name || "—"}</div>
                  </div>

                  <label
                    className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-md p-8 cursor-pointer hover:border-foreground/40 transition-colors ${
                      uploading ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                    <span className="font-body text-sm">
                      {uploading ? "Uploading…" : selected.glb_url ? "Replace 3D model" : "Upload .glb / .gltf  •  or .obj (auto-converted)"}
                    </span>
                    {uploading && (
                      <div className="w-full max-w-[200px]">
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-foreground transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <div className="text-center font-body text-[10px] text-muted-foreground mt-1">
                          {uploadProgress}%
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      <span className="font-body text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">.glb</span>
                      <span className="font-body text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">.gltf</span>
                      <span className="font-body text-[10px] px-1.5 py-0.5 rounded bg-foreground/10 text-foreground">.obj → .glb</span>
                    </div>
                    <span className="font-body text-[11px] text-muted-foreground">Max {MAX_MB} MB</span>
                    <input
                      ref={inputRef}
                      type="file"
                      multiple
                      accept=".glb,.gltf,.obj,.mtl,.png,.jpg,.jpeg,.webp,.bmp,.tga,.tif,.tiff,model/gltf-binary,model/gltf+json,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const fs = e.target.files ? Array.from(e.target.files) : [];
                        if (fs.length) handleUpload(fs);
                      }}
                    />
                    <span className="font-body text-[10px] text-muted-foreground text-center leading-relaxed max-w-[280px]">
                      For OBJ: select the <b>.obj</b> together with its <b>.mtl</b> and any texture images (hold ⌘/Ctrl to multi-select). We convert to GLB right in your browser before uploading.
                    </span>
                  </label>


                  {selected.glb_url && (
                    <>
                      <div className="flex items-center gap-3 text-xs">
                        <a
                          href={selected.glb_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                        >
                          <ExternalLink size={12} /> Open GLB
                        </a>
                        <button
                          onClick={() => handleRemove(selected)}
                          className="inline-flex items-center gap-1 text-destructive hover:underline underline-offset-2"
                        >
                          <Trash2 size={12} /> Remove from product
                        </button>
                      </div>

                      <Product3DViewer
                        url={selected.glb_url}
                        alt={`${selected.product_name} — 3D model`}
                        poster={selected.image_url}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ============ GLB LIBRARY MANAGER ============ */}
          <div className="mt-16 border-t border-border pt-10">
            <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="font-display text-2xl flex items-center gap-2">
                  <Box size={18} /> GLB library
                </h2>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  {withGlb.length} product{withGlb.length === 1 ? "" : "s"} with a 3D model. Click a card to load it above for replacement or removal.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-5">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={managerSearch}
                  onChange={(e) => setManagerSearch(e.target.value)}
                  placeholder="Filter by product name…"
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:outline-none focus:border-foreground/40"
                />
              </div>
              <div className="relative min-w-[220px]">
                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <select
                  value={managerBrand}
                  onChange={(e) => setManagerBrand(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:outline-none focus:border-foreground/40 appearance-none"
                >
                  <option value="">All brands</option>
                  {Array.from(new Set(withGlb.map((r) => r.brand_name).filter(Boolean) as string[]))
                    .sort((a, b) => a.localeCompare(b))
                    .map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                </select>
              </div>
              <div className="relative min-w-[200px]">
                <select
                  value={managerSort}
                  onChange={(e) => setManagerSort(e.target.value as SortKey)}
                  className="w-full pl-3 pr-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:outline-none focus:border-foreground/40 appearance-none"
                  aria-label="Sort GLB library"
                >
                  <option value="updated_desc">Newest uploads first</option>
                  <option value="updated_asc">Oldest uploads first</option>
                  <option value="name_asc">Name A → Z</option>
                  <option value="name_desc">Name Z → A</option>
                </select>
              </div>
              {(managerSearch || managerBrand) && (
                <button
                  onClick={() => { setManagerSearch(""); setManagerBrand(""); setManagerPage(1); }}
                  className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground px-3"
                >
                  Clear
                </button>
              )}
            </div>

            {(() => {
              const filtered = withGlb.filter((r) => {
                if (managerBrand && r.brand_name !== managerBrand) return false;
                if (managerSearch.trim()) {
                  const t = managerSearch.trim().toLowerCase();
                  const hay = `${r.product_name} ${r.brand_name || ""}`.toLowerCase();
                  if (!hay.includes(t)) return false;
                }
                return true;
              });

              const sorted = [...filtered].sort((a, b) => {
                switch (managerSort) {
                  case "name_asc":
                    return a.product_name.localeCompare(b.product_name);
                  case "name_desc":
                    return b.product_name.localeCompare(a.product_name);
                  case "updated_asc":
                    return (a.updated_at || "").localeCompare(b.updated_at || "");
                  case "updated_desc":
                  default:
                    return (b.updated_at || "").localeCompare(a.updated_at || "");
                }
              });

              const total = sorted.length;
              const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
              const page = Math.min(managerPage, totalPages);
              const start = (page - 1) * PAGE_SIZE;
              const pageRows = sorted.slice(start, start + PAGE_SIZE);

              if (total === 0) {
                return (
                  <div className="border border-dashed border-border rounded-md p-10 text-center text-muted-foreground font-body text-sm">
                    {withGlb.length === 0 ? "No products have a 3D model yet." : "No models match the current filters."}
                  </div>
                );
              }

              return (
                <>
                  <div className="flex items-center justify-between mb-3 font-body text-[11px] text-muted-foreground">
                    <span>
                      Showing {start + 1}–{Math.min(start + PAGE_SIZE, total)} of {total}
                    </span>
                    <span className="uppercase tracking-[0.12em]">Page {page} / {totalPages}</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {pageRows.map((row) => (
                      <div key={row.id} className={`group border rounded-md overflow-hidden transition-colors ${selected?.id === row.id ? "border-foreground" : "border-border hover:border-foreground/40"}`}>
                        <button
                          onClick={() => {
                            setSelected(row);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="block w-full text-left"
                        >
                          <div className="relative aspect-square bg-muted">
                            {row.image_url ? (
                              <img src={row.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Box size={22} /></div>
                            )}
                            <span className="absolute top-2 left-2 font-body text-[9px] uppercase tracking-[0.14em] bg-emerald-600 text-white px-1.5 py-0.5 rounded">3D</span>
                          </div>
                          <div className="p-3">
                            <div className="font-body text-sm truncate">{row.product_name}</div>
                            <div className="font-body text-[11px] text-muted-foreground truncate">{row.brand_name || "—"}</div>
                            {row.updated_at && (
                              <div className="font-body text-[10px] text-muted-foreground/70 mt-0.5">
                                {new Date(row.updated_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                              </div>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center justify-between px-3 pb-3 -mt-1">
                          <a
                            href={row.glb_url!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-body text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          >
                            <ExternalLink size={11} /> GLB
                          </a>
                          <button
                            onClick={() => handleRemove(row)}
                            className="inline-flex items-center gap-1 font-body text-[10px] text-destructive hover:underline underline-offset-2"
                          >
                            <Trash2 size={11} /> Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <button
                        onClick={() => setManagerPage(1)}
                        disabled={page === 1}
                        className="px-2.5 py-1 border border-border rounded font-body text-xs disabled:opacity-40 hover:bg-muted/40"
                      >
                        « First
                      </button>
                      <button
                        onClick={() => setManagerPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-2.5 py-1 border border-border rounded font-body text-xs disabled:opacity-40 hover:bg-muted/40"
                      >
                        ‹ Prev
                      </button>
                      <span className="font-body text-xs text-muted-foreground px-2">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setManagerPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-2.5 py-1 border border-border rounded font-body text-xs disabled:opacity-40 hover:bg-muted/40"
                      >
                        Next ›
                      </button>
                      <button
                        onClick={() => setManagerPage(totalPages)}
                        disabled={page === totalPages}
                        className="px-2.5 py-1 border border-border rounded font-body text-xs disabled:opacity-40 hover:bg-muted/40"
                      >
                        Last »
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

      </div>
    </>
  );
};

export default TradeAdminGlbModels;
