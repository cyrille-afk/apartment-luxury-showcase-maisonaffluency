import { Helmet } from "react-helmet-async";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Search, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useVisualiserMaterial, type VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import Breadcrumbs from "@/components/Breadcrumbs";

const CATEGORIES = ["All", "Fabric & Leather", "Rug Finish", "Wood", "Stone", "Metal", "Glass", "Other"];

interface LibraryFabric {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  supplier: string | null;
  sort_order: number;
  is_active: boolean;
}

interface FabricLink {
  fabric_id: string;
  pick_id: string | null;
}

interface FabricPick {
  id: string;
  designer_id: string | null;
}

interface FabricDesigner {
  id: string;
  name: string | null;
  display_name: string | null;
}

export default function TradeMaterialLibrary() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [designerFilter, setDesignerFilter] = useState("all");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeMaterial, setActiveMaterial } = useVisualiserMaterial();

  const { data: swatches = [], isLoading } = useQuery({
    queryKey: ["material-library-fabrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrics")
        .select("id, name, description, image_url, category, supplier, sort_order, is_active")
        .eq("is_active", true)
        .order("category")
        .order("supplier")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data as LibraryFabric[]) || [];
    },
  });

  const { data: picks = [] } = useQuery({
    queryKey: ["material-library-picks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_curator_picks")
        .select("id, designer_id");
      if (error) throw error;
      return (data as FabricPick[]) || [];
    },
  });

  const { data: designers = [] } = useQuery({
    queryKey: ["material-library-designers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, name, display_name");
      if (error) throw error;
      return (data as FabricDesigner[]) || [];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["material-library-links"],
    queryFn: async () => {
      const all: FabricLink[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("product_fabrics")
          .select("fabric_id, pick_id")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (data as FabricLink[]) || [];
        all.push(...batch);
        if (batch.length < pageSize) break;
      }
      return all;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("material-library-fabrics-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fabrics" },
        () => queryClient.invalidateQueries({ queryKey: ["material-library-fabrics"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_fabrics" },
        () => queryClient.invalidateQueries({ queryKey: ["material-library-links"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const supplierOptions = useMemo(() => {
    const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
    return Array.from(new Set(swatches.map((swatch) => swatch.supplier?.trim()).filter(Boolean) as string[])).sort(collator.compare);
  }, [swatches]);

  const designerOptions = useMemo(() => {
    return [...designers]
      .filter((designer) => designer.display_name || designer.name)
      .sort((a, b) => (a.display_name || a.name || "").localeCompare(b.display_name || b.name || "", "en", { sensitivity: "base" }));
  }, [designers]);

  const designerIdsByFabric = useMemo(() => {
    const designerIdByPick = new Map(picks.map((pick) => [pick.id, pick.designer_id]));
    const result = new Map<string, Set<string>>();
    links.forEach((link) => {
      if (!link.pick_id) return;
      const designerId = designerIdByPick.get(link.pick_id);
      if (!designerId) return;
      const ids = result.get(link.fabric_id) || new Set<string>();
      ids.add(designerId);
      result.set(link.fabric_id, ids);
    });
    return result;
  }, [links, picks]);

  const filtered = swatches.filter((s) => {
    const matchesSearch = !search || [s.name, s.supplier, s.description, s.category].some((field) => field?.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = activeCategory === "All" || s.category?.toLowerCase() === activeCategory.toLowerCase();
    const matchesSupplier = supplierFilter === "all" || s.supplier?.trim() === supplierFilter;
    const matchesDesigner = designerFilter === "all" || designerIdsByFabric.get(s.id)?.has(designerFilter) === true;
    return matchesSearch && matchesCat && matchesSupplier && matchesDesigner;
  });

  const selectMaterial = (swatch: LibraryFabric) => {
    setActiveMaterial({
      id: swatch.id,
      name: swatch.name,
      brand_name: swatch.supplier || "Maison Affluency",
      category: swatch.category || "Other",
      material_type: swatch.category,
      color_family: null,
      image_url: swatch.image_url,
    } as VisualiserMaterial);
  };

  return (
    <>
      <Helmet><title>Material Library — Trade Portal</title></Helmet>
      <div className="mx-auto w-full max-w-6xl space-y-6 lg:w-[calc(100%-4rem)] lg:max-w-none [@media(min-width:1440px)]:max-w-[1800px]">
        <div className="flex items-end justify-between gap-6 border-b border-border pb-5">
          <div>
            <h1 className="font-display text-2xl text-foreground">Material Library</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Browse finishes, fabrics, and stone samples by category, colour, or application.
            </p>
          </div>
          {activeMaterial && (
            <Button variant="ghost" onClick={() => navigate("/trade/visualiser")} className="h-auto px-0 font-mono text-[10px] uppercase tracking-[0.15em]">
              Apply {activeMaterial.name} in Visualiser →
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative w-full lg:w-80 lg:shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials..."
              className="pl-10 font-body text-sm"
            />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  variant={activeCategory === cat ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setActiveCategory(cat)}
                  className="h-8 rounded-full px-3 font-body text-xs font-normal"
                >
                  {cat}
                </Button>
              ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:ml-auto">
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger aria-label="Filter by supplier" className="h-9 w-full border-border/70 bg-background font-body text-xs text-muted-foreground sm:w-48">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {supplierOptions.map((supplier) => <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={designerFilter} onValueChange={setDesignerFilter}>
              <SelectTrigger aria-label="Filter by designer" className="h-9 w-full border-border/70 bg-background font-body text-xs text-muted-foreground sm:w-48">
                <SelectValue placeholder="All Designers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Designers</SelectItem>
                {designerOptions.map((designer) => (
                  <SelectItem key={designer.id} value={designer.id}>{designer.display_name || designer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><DotCircleLoader size="sm" className="text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">No materials found. Swatches will appear here once added.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5 [@media(min-width:1440px)]:grid-cols-6">
            {filtered.map((swatch) => (
              <button
                key={swatch.id}
                onClick={() => selectMaterial(swatch)}
                className={`group overflow-hidden text-left ${activeMaterial?.id === swatch.id ? "border-t border-foreground" : "border-t border-border"}`}
              >
                <div className={`material-library-swatch relative aspect-square overflow-hidden rounded-full ${swatch.supplier?.trim().toLowerCase() === "alinea design objects" ? "bg-muted/60" : "bg-muted"}`}>
                  {swatch.image_url ? (
                    <img
                      src={swatch.image_url}
                      alt={swatch.name}
                      className={`h-full w-full ${swatch.supplier?.trim().toLowerCase() === "alinea design objects" ? "object-contain mix-blend-multiply dark:mix-blend-normal" : "object-cover"}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Layers className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-display text-xs text-foreground truncate">{swatch.name}</p>
                  <p className="font-body text-[10px] text-muted-foreground mt-0.5">{swatch.supplier || "Maison Affluency"}</p>
                  <p className="font-body text-[10px] text-muted-foreground/70 mt-0.5">{swatch.category || "Other"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
