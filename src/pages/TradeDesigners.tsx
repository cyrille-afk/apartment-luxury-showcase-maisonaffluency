import { useState, useMemo, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Search, Users, SlidersHorizontal, X, Layers, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllDesigners } from "@/hooks/useDesigner";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import BrandCarousel from "@/components/trade/BrandCarousel";

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

const ALL_FILTER_TAGS = [
  "Furniture", "Lighting", "Ceramics", "Glass", "Textiles",
  "Bronze", "Mirrors", "Sculpture", "Collectible", "Stone",
  "Crystal", "Architecture",
];

type EnrichedDesigner = {
  id: string; slug: string; name: string; founder: string | null; specialty: string;
  image_url: string; source: string; tags: string[]; productCount: number;
  [key: string]: unknown;
};

const DesignerCard = ({ brand, navigate }: { brand: EnrichedDesigner; navigate: (path: string) => void }) => (
  <button
    onClick={() => navigate(`/trade/designers/${brand.slug}`)}
    className="group text-left rounded-xl overflow-hidden border border-border hover:border-foreground/30 transition-all hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
  >
    <div className="aspect-[3/4] bg-muted/20 overflow-hidden relative">
      {brand.image_url ? (
        <img src={brand.image_url} alt={brand.name} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-[0.65]" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted/10 group-hover:bg-muted/20 transition-colors">
          <span className="font-display text-3xl text-muted-foreground/20">{brand.name.charAt(0)}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-10 pb-4">
        <p className="font-display text-sm md:text-[15px] text-white tracking-wide leading-tight drop-shadow-sm">{brand.name}</p>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-4">
        {brand.specialty && (
          <p className="font-body text-[11px] text-white/85 text-center leading-relaxed line-clamp-3 mb-4 max-w-[90%]">{brand.specialty}</p>
        )}
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm text-white font-body text-[10px] uppercase tracking-[0.15em] hover:bg-white/20 transition-colors">More Info</span>
        {brand.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mt-3">
            {brand.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="font-body text-[8px] uppercase tracking-[0.12em] text-white/70 bg-white/10 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        )}
      </div>
      {brand.productCount > 0 && (
        <span className="absolute top-2.5 right-2.5 bg-background/90 backdrop-blur-sm text-foreground font-body text-[10px] px-2 py-0.5 rounded-full border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {brand.productCount} {brand.productCount === 1 ? "piece" : "pieces"}
        </span>
      )}
      {brand.source === "collectible" && (
        <span className="absolute top-2.5 left-2.5 bg-primary/90 backdrop-blur-sm text-primary-foreground font-body text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full">Collectible</span>
      )}
      {brand.founder && !brand.source?.includes("collectible") && (
        <span className="absolute top-2.5 left-2.5 bg-foreground/75 backdrop-blur-sm text-background font-body text-[8px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full flex items-center gap-1">
          <Layers className="h-2.5 w-2.5" />
          {brand.founder}
        </span>
      )}
    </div>
  </button>
);


const TradeDesigners = () => {
  const navigate = useNavigate();
  const { data: designers = [], isLoading } = useAllDesigners();
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [carouselMode, setCarouselMode] = useState<"ateliers" | "designers">("ateliers");
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const allProducts = useMemo(() => getAllTradeProducts(), []);
  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allProducts) {
      const key = p.brand_name.toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [allProducts]);

  const enriched = useMemo(() => {
    return designers.map((d) => {
      const tags = extractTags(d.specialty);
      const productCount = productCountMap.get(d.name.toLowerCase()) || 0;
      return { ...d, tags, productCount };
    });
  }, [designers, productCountMap]);

  // Build carousel: split into ateliers (multi-designer brands) and solo designers
  const { atelierEntries, designerEntries } = useMemo(() => {
    const founderMap = new Map<string, number>();
    const soloNames: string[] = [];
    const founderNames = new Set<string>();

    for (const d of enriched) {
      if (d.founder) founderNames.add(d.founder);
    }

    for (const d of enriched) {
      if (d.founder) {
        founderMap.set(d.founder, (founderMap.get(d.founder) || 0) + 1);
      } else if (!founderNames.has(d.name)) {
        soloNames.push(d.name);
      }
    }

    const ateliers: { name: string; docCount: number }[] = [];
    const solos: { name: string; docCount: number }[] = [];
    const seen = new Set<string>();

    for (const [name, count] of founderMap) {
      if (!seen.has(name)) { seen.add(name); ateliers.push({ name, docCount: count }); }
    }
    for (const name of soloNames) {
      if (!seen.has(name)) { seen.add(name); solos.push({ name, docCount: 0 }); }
    }

    return {
      atelierEntries: ateliers.sort((a, b) => a.name.localeCompare(b.name)),
      designerEntries: solos.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [enriched]);

  const brandEntries = carouselMode === "ateliers" ? atelierEntries : designerEntries;

  // Carousel selection filters the A-Z library when a specific brand/designer is selected
  const filtered = useMemo(() => {
    let result = enriched;

    // If a specific brand is selected from the carousel, filter to that brand's roster
    if (selectedBrand !== "all") {
      if (carouselMode === "ateliers") {
        // Show only designers belonging to this atelier
        result = result.filter((d) => d.founder === selectedBrand);
      } else {
        // Show only the selected solo designer
        result = result.filter((d) => d.name === selectedBrand);
      }
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.specialty.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (activeFilters.length > 0) {
      result = result.filter((b) => activeFilters.some((f) => b.tags.includes(f)));
    }
    return result;
  }, [enriched, search, activeFilters, selectedBrand, carouselMode]);
  type GridEntry = { type: "solo"; designer: EnrichedDesigner; sortName: string };

  const grouped = useMemo(() => {
    const entries: GridEntry[] = [];

    for (const d of filtered) {
      entries.push({ type: "solo", designer: d, sortName: d.name });
    }

    entries.sort((a, b) => a.sortName.localeCompare(b.sortName));
    entries.sort((a, b) => a.sortName.localeCompare(b.sortName));

    const letterMap = new Map<string, GridEntry[]>();
    for (const entry of entries) {
      const letter = entry.sortName.charAt(0).toUpperCase();
      if (!letterMap.has(letter)) letterMap.set(letter, []);
      letterMap.get(letter)!.push(entry);
    }

    return [...letterMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const allLetters = useMemo(() => {
    const letters = new Set<string>();
    for (const b of enriched) {
      letters.add(b.name.charAt(0).toUpperCase());
      if (b.founder) letters.add(b.founder.charAt(0).toUpperCase());
    }
    return [...letters].sort();
  }, [enriched]);

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of enriched) {
      for (const t of b.tags) map.set(t, (map.get(t) || 0) + 1);
    }
    return map;
  }, [enriched]);

  const toggleFilter = (tag: string) => {
    setActiveFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <>
      <Helmet>
        <title>Designers Library — Maison Affluency Trade</title>
      </Helmet>
      <div id="designers-carousel-top" className="space-y-6">
        {(atelierEntries.length > 0 || designerEntries.length > 0) && (
          <BrandCarousel
            brands={brandEntries}
            selectedBrand={selectedBrand}
            onSelect={(b) => {
              setSelectedBrand(b);

              if (b === "all") return;

              // Scroll to the letter
              const letter = b.charAt(0).toUpperCase();
              requestAnimationFrame(() => {
                const el = document.getElementById(`designer-letter-${letter}`);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
            label={
              <div className="mb-2">
                <div className="flex items-center gap-3 mb-1.5">
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
                    Browse by
                  </p>
                  <div className="flex items-center gap-1 bg-muted/40 rounded-full p-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setCarouselMode("ateliers"); setSelectedBrand("all"); }}
                      className={cn(
                        "px-3 py-1 rounded-full font-body text-[10px] uppercase tracking-[0.1em] transition-all",
                        carouselMode === "ateliers"
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Ateliers · {atelierEntries.length}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCarouselMode("designers"); setSelectedBrand("all"); }}
                      className={cn(
                        "px-3 py-1 rounded-full font-body text-[10px] uppercase tracking-[0.1em] transition-all",
                        carouselMode === "designers"
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Designers · {designerEntries.length}
                    </button>
                  </div>
                </div>
                <p className="font-body text-[10px] text-muted-foreground/60 normal-case tracking-normal">
                  {carouselMode === "ateliers"
                    ? "Multi-designer brands — click to expand their roster."
                    : "Independent designers & studios."}
                </p>
              </div>
            }
          />
        )}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl text-foreground tracking-wide">Designers Library</h1>
              <p className="font-body text-sm text-muted-foreground mt-1">
                {enriched.length} designers & ateliers
                {(activeFilters.length > 0 || search) && (
                  <span className="text-primary ml-1">· {filtered.length} showing</span>
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
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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

        {/* Content */}
        {isLoading ? (
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
                : "No designers found."}
            </p>
            {(search || activeFilters.length > 0) && (
              <button
                onClick={() => { setSearch(""); setActiveFilters([]); }}
                className="mt-3 font-body text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(([letter, entries]) => (
              <div key={letter} id={`designer-letter-${letter}`} className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-display text-2xl text-foreground/20 tracking-widest">{letter}</span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                    {entries.length} {entries.length === 1 ? "brand / atelier" : "brands & ateliers"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {entries.map((entry) => (
                    <DesignerCard key={entry.designer.id} brand={entry.designer} navigate={navigate} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back to top FAB */}
      {showBackToTop && (
        <button
          onClick={() => {
            const el = document.getElementById("designers-carousel-top");
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-foreground text-background shadow-lg hover:bg-foreground/90 transition-all font-body text-[11px] uppercase tracking-[0.1em]"
          aria-label="Back to top"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          Back to top
        </button>
      )}
    </>
  );
};

export default TradeDesigners;
