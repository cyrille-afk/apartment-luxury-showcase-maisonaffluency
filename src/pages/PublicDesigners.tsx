import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, X, Layers } from "lucide-react";
import { useAllDesigners, type Designer } from "@/hooks/useDesigner";
import { useParentBrandDesigners } from "@/hooks/useParentBrandDesigners";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ─── Sub-Designers Grid (for parent brands) ──────────────────────────────────
function ParentSubGrid({ parentName, onClose }: { parentName: string; onClose: () => void }) {
  const { data: designers = [] } = useParentBrandDesigners(parentName);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="pt-3 pb-2 pl-2">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-body text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
            {parentName} Designers
          </span>
          <span className="font-body text-[10px] text-muted-foreground/50">({designers.length})</span>
          <div className="flex-1 h-px bg-border/30" />
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted/50 transition-colors" aria-label="Close">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        {designers.length === 0 ? (
          <div className="text-center py-6">
            <span className="font-body text-xs text-muted-foreground/50">Loading…</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2 md:gap-3">
            {designers.map((d) => (
              <Link
                key={d.slug}
                to={`/designers/${d.slug}`}
                className="group/sub rounded-lg overflow-hidden border border-border hover:border-foreground/30 hover:shadow-lg transition-all"
              >
                <div className="aspect-[3/4] relative bg-muted/10 overflow-hidden">
                  {d.image ? (
                    <img src={d.image} alt={d.name} className="w-full h-full object-cover transition-transform duration-500 group-hover/sub:scale-110" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/5">
                      <span className="font-display text-xl text-muted-foreground/20">{d.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/sub:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span className="font-body text-[9px] text-white uppercase tracking-[0.15em]">View</span>
                  </div>
                  <span className="absolute top-2 left-2 bg-foreground/75 backdrop-blur-sm text-background font-body text-[7px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Layers className="h-2 w-2" />
                    {parentName}
                  </span>
                </div>
                <div className="px-2 py-1.5 bg-background">
                  <p className="font-body text-[10px] md:text-[11px] text-foreground leading-tight line-clamp-1 text-center">{d.name}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Letter Group ────────────────────────────────────────────────────────────
function LetterGroup({
  letter,
  designers,
}: {
  letter: string;
  designers: Designer[];
}) {
  const [openParent, setOpenParent] = useState<string | null>(null);

  return (
    <div id={`alpha-${letter}`} className="scroll-mt-32 mb-10">
      {/* Letter heading */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <span className="font-serif text-2xl md:text-3xl text-foreground">{letter}</span>
        <div className="flex-1 h-px bg-border/40" />
        <span className="font-body text-[10px] text-muted-foreground/50 tracking-widest uppercase">
          {designers.length}
        </span>
      </div>

      {/* Card grid — always visible */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
        {designers.map((item) => {
          const isAtelier = item.founder === item.name;
          return (
            <div key={item.slug}>
              <Link
                to={`/designers/${item.slug}`}
                onClick={() => {
                  sessionStorage.removeItem("__scroll_y");
                  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                }}
                className="group block rounded-xl overflow-hidden border border-border hover:border-foreground/30 transition-all hover:shadow-xl bg-background"
              >
                <div className="aspect-[3/4] bg-muted/20 overflow-hidden relative">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-[0.65]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/10 group-hover:bg-muted/20 transition-colors">
                      <span className="font-display text-3xl text-muted-foreground/20">
                        {item.name.charAt(0)}
                      </span>
                    </div>
                  )}

                  {/* Name overlay — top */}
                  <div className="absolute inset-x-0 top-0 px-4 pb-10 pt-3 bg-gradient-to-b from-black/60 via-black/25 to-transparent">
                    <p className="font-display text-sm md:text-[15px] text-white tracking-wide leading-tight drop-shadow-sm">
                      {item.display_name || item.name}
                    </p>
                  </div>

                  {/* Atelier badge */}
                  {isAtelier && (
                    <div className="absolute top-3 right-3 w-14 h-14 md:w-16 md:h-16 bg-foreground flex items-center justify-center p-1.5 overflow-hidden">
                      <span className="font-display text-[6px] md:text-[8px] text-background text-center leading-tight uppercase tracking-[0.12em]">
                        {item.name}
                      </span>
                    </div>
                  )}

                  {/* Founder pill */}
                  {item.founder && !isAtelier && (
                    <span className="absolute top-2.5 right-2.5 bg-foreground/75 backdrop-blur-sm text-background font-body text-[8px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full">
                      {item.founder}
                    </span>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-4">
                    {item.specialty && (
                      <p className="font-body text-[11px] text-white/85 text-center leading-relaxed line-clamp-3 mb-4 max-w-[90%]">
                        {item.specialty}
                      </p>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm text-white font-body text-[10px] uppercase tracking-[0.15em] hover:bg-white/20 transition-colors">
                      View Profile
                    </span>
                  </div>
                </div>
              </Link>

              {/* Parent brand: Designers toggle */}
              {isAtelier && (
                <button
                  onClick={() => setOpenParent(openParent === item.name ? null : item.name)}
                  className="mt-1.5 flex items-center gap-1.5 px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Layers className="h-3 w-3" />
                  <span className="font-body text-[10px] uppercase tracking-[0.12em]">Designers</span>
                  <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${openParent === item.name ? "rotate-180" : ""}`} />
                </button>
              )}

              {/* Sub-designers grid */}
              <AnimatePresence>
                {isAtelier && openParent === item.name && (
                  <ParentSubGrid parentName={item.name} onClose={() => setOpenParent(null)} />
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
const PublicDesigners = () => {
  const { data: allDesigners = [], isLoading } = useAllDesigners();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams] = useSearchParams();
  const letterBarRef = useRef<HTMLDivElement>(null);

  // Jump to letter from URL param
  useEffect(() => {
    const letter = searchParams.get("letter")?.toUpperCase();
    if (letter && LETTERS.includes(letter)) {
      setTimeout(() => {
        document.getElementById(`alpha-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [searchParams]);

  const items = useMemo(
    () =>
      allDesigners
        .filter((d) => d.is_published)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allDesigners]
  );

  // Search filtering
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return items.filter((d) => {
      const name = d.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const specialty = (d.specialty || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const founder = (d.founder || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return name.includes(q) || specialty.includes(q) || founder.includes(q);
    });
  }, [items, searchQuery]);

  // Group by first letter
  const alphaGroups = useMemo(() => {
    const groups: Record<string, Designer[]> = {};
    filteredItems.forEach((d) => {
      const letter = d.name[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(d);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const activeLetters = useMemo(() => new Set(alphaGroups.map(([l]) => l)), [alphaGroups]);

  const jumpToLetter = useCallback((letter: string) => {
    if (!activeLetters.has(letter)) return;
    document.getElementById(`alpha-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeLetters]);

  // When searching, auto-expand all matching letters
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedLetters(new Set(alphaGroups.map(([l]) => l)));
    }
  }, [searchQuery, alphaGroups]);

  const totalCount = filteredItems.length;

  return (
    <>
      <Helmet>
        <title>Designers & Ateliers — Maison Affluency</title>
        <meta
          name="description"
          content="Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting."
        />
        <link rel="canonical" href="https://www.maisonaffluency.com/designers" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Maison Affluency" />
        <meta property="og:url" content="https://www.maisonaffluency.com/designers" />
        <meta property="og:title" content="Designers & Ateliers — Maison Affluency" />
        <meta property="og:description" content="Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting." />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Designers & Ateliers — Maison Affluency" />
        <meta name="twitter:description" content="Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-28 pb-20">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
            className="mb-8"
          >
            <div className="flex flex-wrap items-end gap-3 mb-2">
              <h1 className="font-display text-3xl md:text-4xl tracking-wide">
                Designers & Ateliers
              </h1>
              <span className="font-body text-sm text-muted-foreground mb-1">
                {totalCount}
              </span>
            </div>
            <p className="font-body text-sm text-muted-foreground max-w-2xl">
              A curated directory of the ateliers and independent designers whose work defines our collection.
            </p>
          </motion.div>

          {/* Sticky A-Z bar + Search */}
          <div className="sticky top-16 z-20 bg-background pb-3 pt-2 border-b border-border/30 mb-6">
            {/* A-Z letters */}
            <div
              ref={letterBarRef}
              className="flex items-center gap-2 md:gap-3 lg:gap-4 overflow-x-auto pb-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as any}
            >
              {LETTERS.map((letter) => {
                const isActive = activeLetters.has(letter);
                return (
                  <button
                    key={letter}
                    onClick={() => jumpToLetter(letter)}
                    className={`flex-none font-serif text-base md:text-lg leading-none transition-all duration-200 ${
                      isActive
                        ? "text-foreground hover:text-primary cursor-pointer"
                        : "text-foreground/25 cursor-default"
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative max-w-xs mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search designers…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm bg-background border-border rounded-full focus:border-primary/60 font-body"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-32">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <p className="font-body text-sm text-muted-foreground">
                {searchQuery ? "No designers match your search." : "Content coming soon — we're curating this collection."}
              </p>
            </div>
          )}

          {/* A-Z Groups */}
          {!isLoading && alphaGroups.length > 0 && (
            <div>
              {alphaGroups.map(([letter, designers]) => (
                <LetterGroup
                  key={letter}
                  letter={letter}
                  designers={designers}
                />
              ))}
            </div>
          )}

          {/* Trade CTA */}
          <div className="mt-16 text-center">
            <Link
              to="/trade"
              className="inline-flex items-center gap-2 px-8 py-3 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-md hover:opacity-90 transition-opacity"
            >
              Join Our Trade Program
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default PublicDesigners;
