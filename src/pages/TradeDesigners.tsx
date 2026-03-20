import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface BrandThumbnail {
  id: string;
  brand_name: string;
  thumbnail_url: string;
}

const TradeDesigners = () => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<BrandThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("brand_thumbnails")
        .select("id, brand_name, thumbnail_url")
        .order("brand_name", { ascending: true });
      if (data) setBrands(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return brands;
    const q = search.toLowerCase();
    return brands.filter((b) => b.brand_name.toLowerCase().includes(q));
  }, [brands, search]);

  // Group by first letter for A-Z navigation
  const grouped = useMemo(() => {
    const map = new Map<string, BrandThumbnail[]>();
    for (const b of filtered) {
      const letter = b.brand_name.charAt(0).toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(b);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const allLetters = useMemo(() => {
    const letters = new Set(brands.map((b) => b.brand_name.charAt(0).toUpperCase()));
    return [...letters].sort();
  }, [brands]);

  const handleBrandClick = (brandName: string) => {
    navigate(`/trade/showroom?tab=grid&designer=${encodeURIComponent(brandName)}`);
  };

  return (
    <>
      <Helmet>
        <title>Browse by Designer — Maison Affluency Trade</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-foreground tracking-wide">Browse by Designer</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              {brands.length} designers & ateliers
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search designers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>
        </div>

        {/* A-Z quick jump */}
        <div className="flex flex-wrap gap-1">
          {allLetters.map((letter) => {
            const hasResults = grouped.some(([l]) => l === letter);
            return (
              <button
                key={letter}
                onClick={() => {
                  const el = document.getElementById(`designer-letter-${letter}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={cn(
                  "w-8 h-8 rounded font-display text-xs flex items-center justify-center transition-colors",
                  hasResults
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted/30 text-muted-foreground/40 cursor-default"
                )}
                disabled={!hasResults}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-body text-sm text-muted-foreground">
              {search ? "No designers match your search." : "No designer thumbnails found."}
            </p>
          </div>
        ) : (
          /* Grouped cards */
          <div className="space-y-8">
            {grouped.map(([letter, items]) => (
              <div key={letter} id={`designer-letter-${letter}`} className="scroll-mt-20">
                <h2 className="font-display text-lg text-foreground/60 tracking-widest mb-3 border-b border-border/50 pb-1">
                  {letter}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {items.map((brand) => (
                    <button
                      key={brand.id}
                      onClick={() => handleBrandClick(brand.brand_name)}
                      className="group text-left rounded-lg overflow-hidden border border-border hover:border-foreground/20 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <div className="aspect-square bg-muted/20 overflow-hidden">
                        <img
                          src={brand.thumbnail_url}
                          alt={brand.brand_name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-3 text-center">
                        <p className="font-display text-sm text-foreground tracking-wide leading-tight">
                          {brand.brand_name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default TradeDesigners;
