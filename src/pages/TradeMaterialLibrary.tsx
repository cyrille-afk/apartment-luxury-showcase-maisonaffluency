import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Search, Loader2, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";

const CATEGORIES = ["All", "Fabric", "Stone", "Wood", "Metal", "Leather", "Glass", "Ceramic", "Other"];

export default function TradeMaterialLibrary() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: swatches = [], isLoading } = useQuery({
    queryKey: ["material-swatches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("material_swatches")
        .select("*")
        .eq("is_active", true)
        .order("brand_name")
        .order("name");
      return data || [];
    },
  });

  const filtered = swatches.filter((s: any) => {
    const matchesSearch = !search || [s.name, s.brand_name, s.color_family, s.material_type].some((f: string) => f?.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = activeCategory === "All" || s.category?.toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  return (
    <>
      <Helmet><title>Material Library — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Material Library</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Browse finishes, fabrics, and stone samples by category, colour, or application.
          </p>
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
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">No materials found. Swatches will appear here once added.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((swatch: any) => (
              <div key={swatch.id} className="group border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-square bg-muted relative">
                  {swatch.image_url ? (
                    <img src={swatch.image_url} alt={swatch.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Layers className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {swatch.swatch_code && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-background/80 backdrop-blur-sm rounded text-[9px] font-body text-muted-foreground">
                      {swatch.swatch_code}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-display text-xs text-foreground truncate">{swatch.name}</p>
                  <p className="font-body text-[10px] text-muted-foreground mt-0.5">{swatch.brand_name}</p>
                  {swatch.color_family && (
                    <p className="font-body text-[10px] text-muted-foreground/70 mt-0.5">{swatch.color_family} · {swatch.material_type}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
