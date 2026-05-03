import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Image, Users, FolderOpen, Layers, FileText, FileSpreadsheet, Scissors,
  Columns, Paintbrush, MessageCircle, CalendarClock, Package, Truck,
  CalendarDays, Wallet, RefreshCw, ArrowRightLeft, GraduationCap, Box, BookOpen,
  Wand2, Map, Star, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = { title: string; description: string; url: string; icon: any };
type ToolCategory = { label: string; tools: Tool[] };

const categories: ToolCategory[] = [
  {
    label: "Discover",
    tools: [
      { title: "Gallery", description: "Browse curated interiors and installations", url: "/trade/gallery", icon: Image },
      { title: "Designers & Ateliers", description: "Explore our represented makers", url: "/trade/designers", icon: Users },
      { title: "Resources", description: "Catalogues, price lists & tech sheets", url: "/trade/documents", icon: FolderOpen },
      { title: "Material Library", description: "Swatches, finishes & fabric samples", url: "/trade/materials", icon: Layers },
    ],
  },
  {
    label: "Specification",
    tools: [
      { title: "Quote Builder", description: "Build and submit project quotes", url: "/trade/quotes", icon: FileText },
      { title: "FF&E Schedule", description: "Auto-generate furniture schedules", url: "/trade/ffe-schedule", icon: FileSpreadsheet },
      { title: "Tearsheet Builder", description: "Create printable product specs", url: "/trade/tearsheets", icon: Scissors },
      { title: "Product Comparator", description: "Compare specs side by side", url: "/trade/comparator", icon: Columns },
      { title: "Mood Board", description: "Visual collage for client presentations", url: "/trade/mood-boards", icon: Paintbrush },
      { title: "Floor Plan → FF&E", description: "Upload a plan, get an AI-suggested layout from the catalog", url: "/trade/floor-plan-ffe", icon: Map },
      { title: "Markup & Annotation", description: "Annotate images and drawings", url: "/trade/annotations", icon: MessageCircle },
    ],
  },
  {
    label: "Procurement",
    tools: [
      { title: "Order Timeline", description: "Track orders from deposit to delivery", url: "/trade/order-timeline", icon: CalendarClock },
      { title: "Sample Requests", description: "Request and track material samples", url: "/trade/samples", icon: Package },
      { title: "Shipping Tracker", description: "Real-time delivery progress", url: "/trade/shipping-tracker", icon: Truck },
      { title: "Lead Time Calendar", description: "Production and shipping timelines", url: "/trade/lead-time-calendar", icon: CalendarDays },
      { title: "Budget Tracker", description: "Monitor project spend vs budget", url: "/trade/budget", icon: Wallet },
      { title: "Reorder", description: "Quickly re-order from past quotes", url: "/trade/reorder", icon: RefreshCw },
      { title: "Currency Converter", description: "Convert trade prices across currencies", url: "/trade/currency-converter", icon: ArrowRightLeft },
      { title: "Custom Requests", description: "Bespoke dimensions, finishes & COM/COL fabric", url: "/trade/custom-requests", icon: Wand2 },
      { title: "Showroom & Fair Calendar", description: "Salone, Maison&Objet, PAD, Design Miami — with .ics export", url: "/trade/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Learn",
    tools: [
      { title: "Guides", description: "Studio playbooks for using the Trade Portal", url: "/trade/guides", icon: BookOpen },
      { title: "CPD & Education", description: "Webinars, workshops & CPD tracking", url: "/trade/cpd", icon: GraduationCap },
      { title: "3D Studio", description: "3ds Max + Corona/V-Ray rendering pipeline", url: "/trade/axonometric-requests", icon: Box },
    ],
  },
];

const FAV_KEY = "trade_tools_favorites_v1";

export default function TradeTools() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K → focus search. Esc clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load favorites once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setFavorites(parsed.filter((x) => typeof x === "string"));
      }
    } catch {}
  }, []);

  const persist = useCallback((next: string[]) => {
    setFavorites(next);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const toggleFavorite = useCallback((url: string) => {
    persist(
      favorites.includes(url)
        ? favorites.filter((u) => u !== url)
        : [...favorites, url],
    );
  }, [favorites, persist]);

  const allTools = useMemo(() => categories.flatMap((c) => c.tools), []);
  const favoriteTools = useMemo(
    () => favorites.map((url) => allTools.find((t) => t.url === url)).filter(Boolean) as Tool[],
    [favorites, allTools],
  );

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const filteredCategories = useMemo(() => {
    if (!isSearching) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        tools: cat.tools.filter(
          (t) =>
            t.title.toLowerCase().includes(trimmedQuery) ||
            t.description.toLowerCase().includes(trimmedQuery),
        ),
      }))
      .filter((cat) => cat.tools.length > 0);
  }, [trimmedQuery, isSearching]);
  const totalMatches = filteredCategories.reduce((n, c) => n + c.tools.length, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">Tools</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Everything you need to discover, specify and procure — all in one place.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools by name or description…"
          aria-label="Search tools"
          className="w-full h-11 pl-10 pr-10 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/5 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isSearching && (
        <p className="font-body text-xs text-muted-foreground -mt-6">
          {totalMatches === 0
            ? `No tools match "${query.trim()}"`
            : `${totalMatches} tool${totalMatches === 1 ? "" : "s"} matching "${query.trim()}"`}
        </p>
      )}

      {/* Favorites — only shown after the user stars at least one tool, hidden while searching */}
      {!isSearching && favoriteTools.length > 0 && (
        <section className="rounded-2xl border border-border bg-muted/30 p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 className="font-display text-sm uppercase tracking-[0.15em] text-foreground flex items-center gap-2">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              Your favorites
            </h2>
            <span className="font-body text-[11px] uppercase tracking-widest text-muted-foreground hidden sm:block">
              {favoriteTools.length} pinned
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {favoriteTools.map((tool) => (
              <div
                key={tool.url}
                className="group relative flex items-center gap-2.5 p-3 rounded-lg border border-border bg-background hover:bg-foreground/5 hover:border-foreground/20 transition-all"
              >
                <button
                  onClick={() => navigate(tool.url)}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-foreground/10 transition-colors">
                    <tool.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-body text-xs font-medium text-foreground block truncate">{tool.title}</span>
                    <span className="font-body text-[10px] text-muted-foreground leading-snug block truncate">
                      {tool.description}
                    </span>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(tool.url); }}
                  className="shrink-0 p-1 rounded hover:bg-muted text-accent"
                  aria-label={`Remove ${tool.title} from favorites`}
                  title="Remove from favorites"
                >
                  <Star className="h-3.5 w-3.5 fill-accent" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {filteredCategories.map((cat) => (
        <section key={cat.label}>
          <h2 className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground mb-4">
            {cat.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {cat.tools.map((tool) => {
              const isFav = favorites.includes(tool.url);
              return (
                <div
                  key={tool.url}
                  className="group relative flex items-start gap-3 p-4 rounded-xl border border-border bg-background hover:bg-muted/50 hover:border-foreground/20 transition-all"
                >
                  <button
                    onClick={() => navigate(tool.url)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-foreground/10 transition-colors">
                      <tool.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <div className="min-w-0 pr-6">
                      <span className="font-body text-sm font-medium text-foreground block">{tool.title}</span>
                      <span className="font-body text-xs text-muted-foreground leading-snug block mt-0.5">
                        {tool.description}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(tool.url); }}
                    className={cn(
                      "absolute top-2.5 right-2.5 p-1.5 rounded-md transition-colors",
                      isFav
                        ? "text-accent hover:bg-muted"
                        : "text-muted-foreground/40 hover:text-accent hover:bg-muted opacity-0 group-hover:opacity-100 focus:opacity-100",
                    )}
                    aria-label={isFav ? `Remove ${tool.title} from favorites` : `Add ${tool.title} to favorites`}
                    title={isFav ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star className={cn("h-3.5 w-3.5", isFav && "fill-accent")} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
