import { useEffect, useMemo, useState } from "react";
import { Box, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_MODELS_ONLY, filterVisualiserCatalog, has3dAsset, visualiserCatalogFacets, type VisualiserCatalogItem } from "@/lib/visualiserCatalog";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";

export default function CatalogDrawer<T extends VisualiserCatalogItem>({ products, loading, onAdd, onClose }: {
  products: T[]; loading: boolean; onAdd: (product: T) => void; onClose: () => void;
}) {
  const [modelsOnly, setModelsOnly] = useState(DEFAULT_MODELS_ONLY);
  const [designer, setDesigner] = useState("all");
  const [category, setCategory] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [search, setSearch] = useState("");
  const criteria = useMemo(() => ({ modelsOnly, designer, category, subcategory, search }), [modelsOnly, designer, category, subcategory, search]);
  const matching = useMemo(() => filterVisualiserCatalog(products, criteria), [products, criteria]);
  const facets = useMemo(() => visualiserCatalogFacets(products, criteria), [products, criteria]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section aria-label="Designer Collection Index" className="absolute bottom-32 left-1/2 z-[60] flex max-h-[calc(100%-10rem)] w-[calc(100%-2rem)] max-w-[1040px] -translate-x-1/2 flex-col overflow-hidden rounded-md border border-border bg-background shadow-lg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-body text-xs font-semibold uppercase">Designer Collection Index</h2>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <label htmlFor="catalog-3d-only" className="font-body text-[10px] font-medium uppercase text-muted-foreground">3D Models Only</label>
          <Switch id="catalog-3d-only" checked={modelsOnly} onCheckedChange={next => { setModelsOnly(next); setDesigner("all"); setCategory("all"); setSubcategory("all"); }} />
          <Button variant="ghost" size="icon-sm" aria-label="Close index" title="Close index" onClick={onClose}><X /></Button>
        </div>
      </header>
      <div className="shrink-0 px-5 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select value={designer} onValueChange={next => { setDesigner(next); setCategory("all"); setSubcategory("all"); }}>
            <SelectTrigger aria-label="Designers A-Z" className="min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Designers A-Z</SelectItem>{facets.designers.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={category} onValueChange={next => { setCategory(next); setSubcategory("all"); }}>
            <SelectTrigger aria-label="Categories" className="min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Categories ({facets.categoryTotal})</SelectItem>{facets.categories.map(({ label, count }) => <SelectItem key={label} value={label} disabled={count === 0}>{label} ({count})</SelectItem>)}</SelectContent>
          </Select>
          <Select value={subcategory} onValueChange={setSubcategory}>
            <SelectTrigger aria-label="Subcategories" className="min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Subcategories ({facets.subcategoryTotal})</SelectItem>{facets.subcategories.map(({ label, count }) => <SelectItem key={label} value={label} disabled={count === 0}>{label} ({count})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-border py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search the collection" aria-label="Search the collection" className="min-w-0 w-full bg-transparent font-body text-sm text-foreground outline-hidden placeholder:text-muted-foreground" />
          </div>
          <span aria-live="polite" className="shrink-0 font-body text-xs tabular-nums text-muted-foreground">{loading ? "Loading…" : `${matching.length} ${matching.length === 1 ? "item" : "items"}`}</span>
        </div>
      </div>
      <div className="overflow-y-auto px-5 pb-5">
        <div className="flex gap-4 overflow-x-auto pb-3" aria-label="Catalog assets" aria-busy={loading}>
          {loading ? Array.from({ length: 6 }, (_, index) => <div key={index} className="w-36 shrink-0 motion-safe:animate-pulse"><div className="h-28 rounded-sm bg-muted" /><div className="mt-3 h-3 w-24 bg-muted" /><div className="mt-2 h-3 w-32 bg-muted" /></div>) : matching.map(product => (
            <Button key={product.id} variant="ghost" onClick={() => onAdd(product)} aria-label={`Add ${product.product_name}`} data-catalog-product={product.id} data-model-asset={has3dAsset(product)} className="group flex h-auto w-36 shrink-0 flex-col items-stretch justify-start gap-0 whitespace-normal rounded-sm p-2 text-left">
              <div className="relative h-28 w-full">
                {product.image_url ? <img src={optimizeImageUrl(product.image_url, "w_400,c_limit,q_auto,f_auto")} alt={product.product_name} loading="lazy" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none" /> : <Box className="mx-auto h-full w-12 text-muted-foreground" />}
                {has3dAsset(product) && <span className="absolute right-0 top-0 flex items-center gap-1 bg-background/90 px-1 text-[10px] text-foreground"><Box className="h-3 w-3" />3D</span>}
              </div>
              <span className="mt-3 line-clamp-2 min-h-8 text-[10px] uppercase text-muted-foreground">{product.brand_name}</span>
              <span className="line-clamp-2 min-h-8 text-xs text-foreground">{product.product_name}</span>
            </Button>
          ))}
          {!loading && matching.length === 0 && <p className="py-8 font-body text-sm text-muted-foreground">No pieces match these filters.</p>}
        </div>
      </div>
    </section>
  );
}
