import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, Link } from "react-router-dom";
import { ChevronLeft, Search, Upload, Loader2, Trash2, ExternalLink, Box } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Product3DViewer from "@/components/trade/Product3DViewer";

interface ProductRow {
  id: string;
  product_name: string;
  brand_name: string | null;
  image_url: string | null;
  glb_url: string | null;
}

const MAX_MB = 50;

const TradeAdminGlbModels: React.FC = () => {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [withGlb, setWithGlb] = useState<ProductRow[]>([]);
  const [results, setResults] = useState<ProductRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Load products that already have a GLB
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, glb_url")
        .not("glb_url", "is", null)
        .order("updated_at", { ascending: false })
        .limit(100);
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

  const handleUpload = async (file: File) => {
    if (!selected) return;
    const name = file.name.toLowerCase();
    if (!(name.endsWith(".glb") || name.endsWith(".gltf"))) {
      toast({ title: "Wrong file type", description: "Please upload a .glb or .gltf model.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `${(file.size / 1024 / 1024).toFixed(1)} MB — max is ${MAX_MB} MB.`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const ext = name.endsWith(".gltf") ? "gltf" : "glb";
      const contentType = ext === "glb" ? "model/gltf-binary" : "model/gltf+json";
      const path = `glb-models/${selected.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("assets")
        .upload(path, file, { contentType, cacheControl: "31536000", upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: updErr } = await supabase
        .from("trade_products")
        .update({ glb_url: publicUrl })
        .eq("id", selected.id);
      if (updErr) throw updErr;

      toast({ title: "3D model saved", description: selected.product_name });
      setSelected({ ...selected, glb_url: publicUrl });
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setUploading(false);
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
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Removed" });
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
                      {uploading ? "Uploading…" : selected.glb_url ? "Replace 3D model" : "Upload .glb or .gltf"}
                    </span>
                    <span className="font-body text-[11px] text-muted-foreground">Max {MAX_MB} MB</span>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                      }}
                    />
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
        </div>
      </div>
    </>
  );
};

export default TradeAdminGlbModels;
