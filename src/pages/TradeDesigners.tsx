import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Search, Users, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getAllDesignerProfiles, type DesignerProfile } from "@/lib/designerProfiles";
import { getAllTradeProducts, type TradeProduct } from "@/lib/tradeProducts";
import { Badge } from "@/components/ui/badge";

interface BrandThumbnail {
  id: string;
  brand_name: string;
  thumbnail_url: string;
}

/** Extract short discipline tags from a specialty string */
function extractTags(specialty: string): string[] {
  if (!specialty) return [];
  const tags: string[] = [];
  const lower = specialty.toLowerCase();

  if (lower.includes("furniture")) tags.push("Furniture");
  if (lower.includes("lighting") || lower.includes("lamp")) tags.push("Lighting");
  if (lower.includes("ceramic")) tags.push("Ceramics");
  if (lower.includes("glass")) tags.push("Glass");
  if (lower.includes("rug") || lower.includes("textile")) tags.push("Textiles");
  if (lower.includes("bronze")) tags.push("Bronze");
  if (lower.includes("mirror") || lower.includes("reflective")) tags.push("Mirrors");
  if (lower.includes("sculpture") || lower.includes("sculptural")) tags.push("Sculpture");
  if (lower.includes("collectible") || lower.includes("limited edition")) tags.push("Collectible");
  if (lower.includes("stone") || lower.includes("marble") || lower.includes("alabaster")) tags.push("Stone");
  if (lower.includes("crystal")) tags.push("Crystal");
  if (lower.includes("architect")) tags.push("Architecture");

  return tags.length > 0 ? tags : ["Design"];
}

/** All possible filter tags */
const ALL_FILTER_TAGS = [
  "Furniture", "Lighting", "Ceramics", "Glass", "Textiles",
  "Bronze", "Mirrors", "Sculpture", "Collectible", "Stone",
  "Crystal", "Architecture",
];

const TradeDesigners = () => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<BrandThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Get designer profiles and products for enrichment
  const designerProfiles = useMemo(() => getAllDesignerProfiles(), []);
  const allProducts = useMemo(() => getAllTradeProducts(), []);

  // Build lookup maps
  const profileMap = useMemo(() => {
    const map = new Map<string, DesignerProfile>();
    for (const p of designerProfiles) {
      map.set(p.name.toLowerCase(), p);
    }
    return map;
  }, [designerProfiles]);

  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allProducts) {
      const key = p.brand_name.toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [allProducts]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const p of allProducts) {
      const key = p.brand_name.toLowerCase();
      if (!map.has(key)) map.set(key, new Set());
      if (p.category) map.get(key)!.add(p.category);
    }
    return map;
  }, [allProducts]);

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

  // Enriched brand data
  const enrichedBrands = useMemo(() => {
    return brands.map((b) => {
      const key = b.brand_name.toLowerCase();
      const profile = profileMap.get(key);
      const productCount = productCountMap.get(key) || 0;
      const specialty = profile?.specialty || "";
      const tags = extractTags(specialty);
      const categories = categoryMap.get(key);
      const source = profile?.source;

      return {
        ...b,
        specialty,
        tags,
        productCount,
        categories: categories ? [...categories] : [],
        source,
        hasProfile: !!profile,
      };
    });
  }, [brands, profileMap, productCountMap, categoryMap]);

  // Filter by search + tags
  const filtered = useMemo(() => {
    let result = enrichedBrands;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.brand_name.toLowerCase().includes(q) ||
          b.specialty.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (activeFilters.length > 0) {
      result = result.filter((b) =>
        activeFilters.some((f) => b.tags.includes(f))
      );
    }

    return result;
  }, [enrichedBrands, search, activeFilters]);

  // Group by first letter
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
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

  // Active filter tags with counts
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of enrichedBrands) {
      for (const t of b.tags) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return map;
  }, [enrichedBrands]);

  const toggleFilter = (tag: string) => {
    setActiveFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleBrandClick = (brandName: string) => {
    navigate(`/trade/showroom?tab=grid&designer=${encodeURIComponent(brandName)}`);
  };

  return (
    <>
      <Helmet>
        <title>Ateliers & Partners — Maison Affluency Trade</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl text-foreground tracking-wide">
                Ateliers & Partners
              </h1>
              <p className="font-body text-sm text-muted-foreground mt-1">
                {enrichedBrands.length} designers & ateliers
                {activeFilters.length > 0 && (
                  <span className="text-primary ml-1">
                    · {filtered.length} showing
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search designers, materials…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "shrink-0 p-2 rounded-md border transition-colors",
                  showFilters || activeFilters.length > 0
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilters.length > 0 && (
                  <span className="absolute -mt-6 ml-3 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {activeFilters.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filter chips */}
          {showFilters && (
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border">
              {ALL_FILTER_TAGS.filter((t) => (tagCounts.get(t) || 0) > 0).map((tag) => {
                const active = activeFilters.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleFilter(tag)}
                    className={cn(
                      "px-3 py-1 rounded-full font-body text-[10px] uppercase tracking-[0.1em] transition-all border",
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                    )}
                  >
                    {tag}
                    <span className="ml-1 opacity-60">{tagCounts.get(tag)}</span>
                  </button>
                );
              })}
              {activeFilters.length > 0 && (
                <button
                  onClick={() => setActiveFilters([])}
                  className="px-3 py-1 rounded-full font-body text-[10px] uppercase tracking-[0.1em] text-destructive hover:text-destructive/80 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
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
              <div key={i} className="aspect-[3/4] bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-body text-sm text-muted-foreground">
              {search || activeFilters.length > 0
                ? "No designers match your criteria."
                : "No designer thumbnails found."}
            </p>
            {(search || activeFilters.length > 0) && (
              <button
                onClick={() => {
                  setSearch("");
                  setActiveFilters([]);
                }}
                className="mt-3 font-body text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          /* Grouped cards */
          <div className="space-y-10">
            {grouped.map(([letter, items]) => (
              <div key={letter} id={`designer-letter-${letter}`} className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-display text-2xl text-foreground/20 tracking-widest">
                    {letter}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                    {items.length} {items.length === 1 ? "atelier" : "ateliers"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {items.map((brand) => (
                    <button
                      key={brand.id}
                      onClick={() => handleBrandClick(brand.brand_name)}
                      className="group text-left rounded-lg overflow-hidden border border-border hover:border-foreground/20 transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square bg-muted/20 overflow-hidden relative">
                        <img
                          src={brand.thumbnail_url}
                          alt={brand.brand_name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                        {/* Product count badge */}
                        {brand.productCount > 0 && (
                          <span className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm text-foreground font-body text-[10px] px-2 py-0.5 rounded-full border border-border/50">
                            {brand.productCount} {brand.productCount === 1 ? "piece" : "pieces"}
                          </span>
                        )}
                        {/* Source badge */}
                        {brand.source === "collectible" && (
                          <span className="absolute top-2 left-2 bg-primary/90 backdrop-blur-sm text-primary-foreground font-body text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                            Collectible
                          </span>
                        )}
                      </div>

                      {/* Card info */}
                      <div className="p-3 space-y-2">
                        <p className="font-display text-sm text-foreground tracking-wide leading-tight text-center">
                          {brand.brand_name}
                        </p>

                        {/* Specialty subtitle */}
                        {brand.specialty && (
                          <p className="font-body text-[10px] text-muted-foreground text-center leading-snug line-clamp-1">
                            {brand.specialty}
                          </p>
                        )}

                        {/* Category tags */}
                        {brand.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {brand.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="font-body text-[8px] uppercase tracking-[0.12em] text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
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
