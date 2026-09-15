import { Helmet } from "react-helmet-async";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Search, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useVisualiserMaterial, type VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";

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

export default function TradeMaterialLibrary() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
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

  useEffect(() => {
    const channel = supabase
      .channel("material-library-fabrics-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fabrics" },
        () => queryClient.invalidateQueries({ queryKey: ["material-library-fabrics"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = swatches.filter((s) => {
    const matchesSearch = !search || [s.name, s.supplier, s.description, s.category].some((field) => field?.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = activeCategory === "All" || s.category?.toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCat;
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
      <div className="mx-auto w-full max-w-6xl space-y-6 [@media(min-width:1440px)]:max-w-[min(90vw,1800px)]">
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

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
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
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full font-body text-xs transition-colors ${activeCategory === cat ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                {cat}
              </button>
            ))}
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            {filtered.map((swatch) => (
              <button
                key={swatch.id}
                onClick={() => selectMaterial(swatch)}
                className={`group overflow-hidden text-left ${activeMaterial?.id === swatch.id ? "border-t border-foreground" : "border-t border-border"}`}
              >
                <div className="aspect-square overflow-hidden rounded-full bg-muted relative">
                  {swatch.image_url ? (
                    <img src={swatch.image_url} alt={swatch.name} className="w-full h-full object-cover" loading="lazy" />
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
