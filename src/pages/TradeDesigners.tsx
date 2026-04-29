import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Search, Users, X, Layers, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllDesigners } from "@/hooks/useDesigner";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import BrandCarousel from "@/components/trade/BrandCarousel";
import SectionHero from "@/components/trade/SectionHero";

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

const normalizeText = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const initialOf = (value: string | null | undefined) => {
  const first = normalizeText(value).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
};


type EnrichedDesigner = {
  id: string; slug: string; name: string; founder: string | null; specialty: string;
  image_url: string; source: string; tags: string[]; productCount: number;
  logo_url?: string | null;
  isAtelierCard?: boolean;
  [key: string]: unknown;
};

const DesignerCard = ({ brand, navigate }: { brand: EnrichedDesigner; navigate: (path: string) => void }) => {
  const isAtelier = brand.isAtelierCard;
  return (
    <button
      onClick={() => {
        sessionStorage.removeItem("__scroll_y");
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        navigate(`/trade/designers/${brand.slug}`);
      }}
      className={cn(
        "group text-left rounded-xl overflow-hidden border transition-all hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background",
        isAtelier
          ? "border-primary/40 ring-1 ring-primary/20 hover:border-primary/60"
          : "border-border hover:border-foreground/30"
      )}
    >
      <div className="aspect-[3/4] bg-muted/20 overflow-hidden relative">
        {brand.image_url ? (
          <img src={brand.image_url} alt={brand.name} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-[0.65]" loading="lazy" />
        ) : (
          <div className={cn(
            "w-full h-full flex items-center justify-center transition-colors",
            isAtelier ? "bg-primary/5 group-hover:bg-primary/10" : "bg-muted/10 group-hover:bg-muted/20"
          )}>
            <span className={cn(
              "font-display text-3xl",
              isAtelier ? "text-primary/40" : "text-muted-foreground/20"
            )}>{brand.name.charAt(0)}</span>
          </div>
        )}
        {!isAtelier && (
          <div className="absolute inset-x-0 bottom-0 px-4 pt-10 pb-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
            <p className="font-display text-sm md:text-[15px] text-white tracking-wide leading-tight drop-shadow-sm">{brand.name}</p>
          </div>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-4">
          {brand.specialty && (
            <p className="font-body text-[11px] text-white/85 text-center leading-relaxed line-clamp-3 mb-4 max-w-[90%]">{brand.specialty}</p>
          )}
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm text-white font-body text-[10px] uppercase tracking-[0.15em] hover:bg-white/20 transition-colors">More Info</span>
        </div>
        {brand.source === "collectible" && (
          <span className="absolute top-2.5 left-2.5 bg-primary/90 backdrop-blur-sm text-primary-foreground font-body text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full">Collectible</span>
        )}
        {isAtelier && !brand.source?.includes("collectible") && (
          <div className="absolute top-2.5 left-2.5 w-11 h-11 md:w-14 md:h-14 bg-foreground flex items-center justify-center p-1 overflow-hidden rounded-sm">
            <span className="font-display text-[6px] md:text-[7.5px] text-background text-center leading-[1.15] uppercase tracking-[0.1em]">{brand.name}</span>
          </div>
        )}
        {brand.founder && !isAtelier && !brand.source?.includes("collectible") && (
          <span className="absolute top-2.5 left-2.5 bg-foreground/75 backdrop-blur-sm text-background font-body text-[8px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full flex items-center gap-1">
            <Layers className="h-2.5 w-2.5" />
            {brand.founder}
          </span>
        )}
      </div>
    </button>
  );
};


const TradeDesigners = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: designers = [], isLoading } = useAllDesigners();
  const [search, setSearch] = useState("");
  const [activeFilters] = useState<string[]>([]);
  const initialBrand = searchParams.get("brand") || "all";
  const [selectedBrand, setSelectedBrand] = useState(initialBrand);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [mobileCarouselMode, setMobileCarouselMode] = useState<"ateliers" | "designers">("ateliers");

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { allProducts } = useTradeProducts();
  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allProducts) {
      const key = p.brand_name.toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [allProducts]);

  // Build a map of brand_name (lowercase) → concatenated material strings for search
  const brandMaterialsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allProducts) {
      if (!p.materials) continue;
      const key = normalizeText(p.brand_name);
      const prev = map.get(key) || "";
      map.set(key, `${prev} ${normalizeText(p.materials)}`);
    }
    return map;
  }, [allProducts]);

  // Child designers hidden from the grid — parent atelier card represents them.
  const HIDDEN_CHILD_DESIGNERS = useMemo(
    () => new Set(["laura demichelis", "leo aerts"]),
    []
  );

  const enriched = useMemo(() => {
    return designers
      .filter((d) => !HIDDEN_CHILD_DESIGNERS.has(normalizeText(d.name)))
      .map((d) => {
        const tags = extractTags(d.specialty);
        const productCount = productCountMap.get(d.name.toLowerCase()) || 0;
        const isAtelierCard = !!(d.founder && d.founder === d.name);
        return { ...d, tags, productCount, isAtelierCard };
      });
  }, [designers, productCountMap, HIDDEN_CHILD_DESIGNERS]);

  // Split carousel entries into ateliers vs designers
  const atelierCarouselEntries = useMemo(() => {
    const seen = new Set<string>();
    const entries: { name: string; docCount: number; imageUrl?: string; isAtelier?: boolean }[] = [];
    for (const d of enriched) {
      if (d.isAtelierCard && !seen.has(d.name)) {
        seen.add(d.name);
        entries.push({ name: d.name, docCount: 0, imageUrl: d.image_url || undefined, isAtelier: true });
      }
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [enriched]);

  const designerCarouselEntries = useMemo(() => {
    const seen = new Set<string>();
    const entries: { name: string; docCount: number; imageUrl?: string }[] = [];
    for (const d of enriched) {
      if (!d.isAtelierCard && !seen.has(d.name)) {
        seen.add(d.name);
        entries.push({ name: d.name, docCount: 0, imageUrl: d.image_url || undefined });
      }
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [enriched]);

  // Unified filtering — all records in one flat list
  const filtered = useMemo(() => {
    let result = enriched.slice();

    if (selectedBrand !== "all") {
      const selected = normalizeText(selectedBrand);
      result = result.filter(
        (d) => normalizeText(d.name) === selected || normalizeText(d.founder) === selected
      );
    }

    if (search) {
      const q = normalizeText(search);
      result = result.filter(
        (b) =>
          normalizeText(b.name).includes(q) ||
          normalizeText(b.founder).includes(q) ||
          normalizeText(b.specialty).includes(q) ||
          b.tags.some((t) => normalizeText(t).includes(q)) ||
          (brandMaterialsMap.get(normalizeText(b.name)) || "").includes(q) ||
          (brandMaterialsMap.get(normalizeText(b.founder)) || "").includes(q)
      );
    }
    if (activeFilters.length > 0) {
      result = result.filter((b) => activeFilters.some((f) => b.tags.includes(f)));
    }
    return result;
  }, [enriched, search, activeFilters, selectedBrand, brandMaterialsMap]);

  // Group into A-Z sections with atelier header cards sorting first in their group
  const grouped = useMemo(() => {
    const entries: { designer: EnrichedDesigner; sortName: string }[] = [];

    for (const d of filtered) {
      const sortName = d.isAtelierCard
        ? `${d.name}\0\0`
        : d.founder && d.founder !== d.name
          ? d.founder === selectedBrand
            ? `${d.founder}\0\x01${d.name}`
            : d.name
          : d.name;
      entries.push({ designer: d, sortName });
    }

    entries.sort((a, b) => {
      const aFounder = a.designer.isAtelierCard ? a.designer.name : (a.designer.founder === selectedBrand ? a.designer.founder : "");
      const bFounder = b.designer.isAtelierCard ? b.designer.name : (b.designer.founder === selectedBrand ? b.designer.founder : "");
      if (aFounder && bFounder && aFounder === bFounder) {
        if (a.designer.isAtelierCard && !b.designer.isAtelierCard) return -1;
        if (!a.designer.isAtelierCard && b.designer.isAtelierCard) return 1;
        return a.designer.name.localeCompare(b.designer.name);
      }
      const aGroup = aFounder || a.designer.name;
      const bGroup = bFounder || b.designer.name;
      return aGroup.localeCompare(bGroup);
    });

    const letterMap = new Map<string, typeof entries>();
    for (const entry of entries) {
      const d = entry.designer;
      const groupName = d.isAtelierCard ? d.name : (d.founder === selectedBrand ? d.founder : d.name);
      const letter = initialOf(groupName);
      if (!letterMap.has(letter)) letterMap.set(letter, []);
      letterMap.get(letter)!.push(entry);
    }

    // Within each letter, sort ateliers first, then alphabetically
    for (const [, group] of letterMap) {
      group.sort((a, b) => {
        if (a.designer.isAtelierCard && !b.designer.isAtelierCard) return -1;
        if (!a.designer.isAtelierCard && b.designer.isAtelierCard) return 1;
        return a.designer.name.localeCompare(b.designer.name);
      });
    }

    return [...letterMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, selectedBrand]);

  const allLetters = useMemo(() => {
    const letters = new Set<string>();
    for (const b of enriched) {
      letters.add(initialOf(b.name));
      if (b.founder) letters.add(initialOf(b.founder));
    }
    return [...letters].sort();
  }, [enriched]);

  return (
    <>
      <Helmet>
        <title>Designers & Ateliers Library — Maison Affluency Trade</title>
      </Helmet>
      <div id="designers-carousel-top" className="space-y-6">
        <SectionHero
          section="designers"
          title="Designers & Ateliers Library"
          subtitle="Discover ateliers and designers by signature materials and collections."
        />

        {/* Stats + search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-body text-sm text-muted-foreground">
            32 Ateliers · 274 Designers
            {search && (
              <span className="text-primary ml-1">· {filtered.length} showing</span>
            )}
          </p>
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
          </div>
        </div>

        {/* Carousels below title */}
        {(atelierCarouselEntries.length > 0 || designerCarouselEntries.length > 0) && (
          <>
            <div className="hidden sm:block space-y-4">
              {atelierCarouselEntries.length > 0 && (
                <BrandCarousel
                  brands={atelierCarouselEntries}
                  selectedBrand={selectedBrand}
                  onSelect={(b) => {
                    setSelectedBrand(b);
                    if (b === "all") return;
                    const letter = initialOf(b);
                    requestAnimationFrame(() => {
                      const el = document.getElementById(`designer-letter-${letter}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  label={
                    <p className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-2">
                      Ateliers · 32
                    </p>
                  }
                />
              )}
              {designerCarouselEntries.length > 0 && (
                <BrandCarousel
                  brands={designerCarouselEntries}
                  selectedBrand={selectedBrand}
                  onSelect={(b) => {
                    setSelectedBrand(b);
                    if (b === "all") return;
                    const letter = initialOf(b);
                    requestAnimationFrame(() => {
                      const el = document.getElementById(`designer-letter-${letter}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  label={
                    <p className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-2">
                      Designers · 274
                    </p>
                  }
                />
              )}
            </div>

            <div className="sm:hidden space-y-3">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setMobileCarouselMode("ateliers")}
                  className={cn(
                    "px-3 py-1.5 rounded-full font-body text-[10px] uppercase tracking-[0.12em] transition-all border",
                    mobileCarouselMode === "ateliers"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border hover:border-foreground/40"
                  )}
                >
                  Ateliers · 32
                </button>
                <button
                  onClick={() => setMobileCarouselMode("designers")}
                  className={cn(
                    "px-3 py-1.5 rounded-full font-body text-[10px] uppercase tracking-[0.12em] transition-all border",
                    mobileCarouselMode === "designers"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border hover:border-foreground/40"
                  )}
                >
                  Designers · 274
                </button>
              </div>
              <BrandCarousel
                brands={mobileCarouselMode === "ateliers" ? atelierCarouselEntries : designerCarouselEntries}
                selectedBrand={selectedBrand}
                onSelect={(b) => {
                  setSelectedBrand(b);
                  if (b === "all") return;
                  const letter = initialOf(b);
                  requestAnimationFrame(() => {
                    const el = document.getElementById(`designer-letter-${letter}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              />
            </div>
          </>
        )}

        {/* A-Z quick jump */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide sm:flex-wrap sm:overflow-visible pb-1 sm:pb-0 -mx-1 px-1">
          {allLetters.map((letter) => {
            const hasResults = grouped.some(([l]) => l === letter);
            const hasAnyResults = enriched.some((d) => {
              const ch = initialOf(d.name);
              const fch = d.founder ? initialOf(d.founder) : null;
              return ch === letter || fch === letter;
            });
            return (
              <button
                key={letter}
                onClick={() => {
                  if (selectedBrand !== "all") setSelectedBrand("all");
                  requestAnimationFrame(() => {
                    const el = document.getElementById(`designer-letter-${letter}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
                className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded font-display text-xs flex-shrink-0 flex items-center justify-center transition-colors",
                  hasResults
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : hasAnyResults
                      ? "bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      : "bg-muted/30 text-muted-foreground/40 cursor-default"
                )}
                disabled={!hasAnyResults}
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
            {search && (
              <button
                onClick={() => setSearch("")}
                className="mt-3 font-body text-xs text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : selectedBrand !== "all" ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="font-display text-sm text-foreground tracking-wide">{selectedBrand}</span>
              <div className="flex-1 h-px bg-border" />
              <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered
                .slice()
                .sort((a, b) => {
                  if (a.isAtelierCard && !b.isAtelierCard) return -1;
                  if (!a.isAtelierCard && b.isAtelierCard) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((d) => (
                  <DesignerCard key={d.id} brand={d} navigate={navigate} />
                ))}
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(([letter, entries]) => (
              <div key={letter} id={`designer-letter-${letter}`} className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-display text-2xl text-foreground/20 tracking-widest">{letter}</span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                    {entries.length} {entries.length === 1 ? "entry" : "entries"}
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
