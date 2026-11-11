import { getStudioPairings } from "@/lib/studioPairings.functions";
import { setStudioPairingFavorite } from "@/lib/studioPairingFavorites.functions";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bookmark, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioPairingFolderPicker } from "./StudioPairingFolderPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterStudioPairings, studioPairingFilterOptions } from "@/lib/studioPairingFilters";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type CuratorialSourceItem = {
  product_id: string;
  name: string;
  designer: string;
  image_url: string | null;
  selected_finish?: string | null;
};

type Recommendation = {
  product_id: string;
  score: number;
  editorial_tag: string;
  reason: string;
  title: string;
  subtitle: string;
  image_url: string;
  category: string;
  finishes: string[];
  brand: string;
  anchors?: Array<{ name: string; brand: string; category: string }>;
};

type Props = {
  projectId: string;
  projectName: string;
  items: CuratorialSourceItem[];
  activeItemId: string | null;
  isClientMode: boolean;
  docked?: boolean;
  focused?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onActiveItemChange: (productId: string) => void;
  onCompositionChanged: () => void;
  onRecommendationHover: (active: boolean) => void;
};

const HEIGHTS = [
  "clamp(300px,26dvh,420px)",
  "clamp(360px,30dvh,540px)",
  "min(620px,calc(100dvh - 48px))",
] as const;

export function ProjectCuratorialGuide({
  projectId,
  projectName,
  items,
  activeItemId,
  isClientMode,
  docked = false,
  focused = false,
  open: controlledOpen,
  onOpenChange,
  onActiveItemChange,
  onCompositionChanged,
  onRecommendationHover,
}: Props) {
  const fetchPairings = useServerFn(getStudioPairings);
  const saveFavorite = useServerFn(setStudioPairingFavorite);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setInternalOpen(value);
  };
  const [heightIndex, setHeightIndex] = useState(1);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [savedRecommendations, setSavedRecommendations] = useState<Recommendation[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritePending, setFavoritePending] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const referenceRef = useRef(activeItemId);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [finishFilter, setFinishFilter] = useState("");
  const streamRecommendations = favoritesOnly ? savedRecommendations : recommendations;
  const filterOptions = useMemo(() => studioPairingFilterOptions(streamRecommendations), [streamRecommendations]);
  const visibleRecommendations = useMemo(() => filterStudioPairings(streamRecommendations, categoryFilter, finishFilter), [streamRecommendations, categoryFilter, finishFilter]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [connector, setConnector] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const firstRecommendationRef = useRef<HTMLElement | null>(null);

  const activeItem = useMemo(
    () => items.find((item) => item.product_id === activeItemId) || items[0] || null,
    [activeItemId, items],
  );
  referenceRef.current = activeItem?.product_id || null;

  useEffect(() => {
    if (!activeItemId && items[0]) onActiveItemChange(items[0].product_id);
  }, [activeItemId, items, onActiveItemChange]);

  useEffect(() => {
    setCategoryFilter("");
    setFinishFilter("");
    setFavoritesOnly(false);
  }, [activeItem?.product_id, activeItem?.selected_finish]);

  useEffect(() => {
    if (!open || !activeItem) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setRecommendations([]);
      setSavedRecommendations([]);
      setFavoriteIds(new Set());
      try {
        const data = await fetchPairings({ data: { referenceId: activeItem.product_id, selectedFinish: activeItem.selected_finish?.slice(0, 2000), excludedIds: items.map((item) => item.product_id) } });
        if (cancelled) return;
        const excluded = new Set(items.map((item) => item.product_id));
        const seen = new Set<string>();
        setFavoriteIds(new Set(data.favoriteIds));
        setSavedRecommendations(data.savedRecommendations);
        setRecommendations(data.recommendations.filter((rec) => {
          if (excluded.has(rec.product_id) || seen.has(rec.product_id)) return false;
          seen.add(rec.product_id);
          return true;
        }));
      } catch {
        if (cancelled) return;
        setError("Curation analysis is temporarily unavailable. Please reopen the studio to try again.");
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, items, activeItem, fetchPairings]);

  const toggleFavorite = async (rec: Recommendation) => {
    if (!activeItem || favoritePending) return;
    const referenceId = activeItem.product_id;
    const saved = !favoriteIds.has(rec.product_id);
    setFavoritePending(true);
    setError(null);
    try {
      await saveFavorite({ data: { referenceId, productId: rec.product_id, saved } });
      if (referenceRef.current !== referenceId) return;
      setFavoriteIds(current => {
        const next = new Set(current);
        if (saved) next.add(rec.product_id); else next.delete(rec.product_id);
        return next;
      });
      setSavedRecommendations(current => saved ? [...current.filter(item => item.product_id !== rec.product_id), rec] : current.filter(item => item.product_id !== rec.product_id));
    } catch {
      if (referenceRef.current === referenceId) setError("Your favorites could not be updated. Please try again.");
    } finally {
      setFavoritePending(false);
    }
  };

  useEffect(() => {
    if (!open || focused) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, focused]);

  useEffect(() => {
    if (!open) onRecommendationHover(false);
    return () => onRecommendationHover(false);
  }, [open, onRecommendationHover]);

  useEffect(() => {
    const openGuide = () => setOpen(true);
    window.addEventListener("project-curator:open", openGuide);
    return () => window.removeEventListener("project-curator:open", openGuide);
  }, []);

  useEffect(() => {
    if (!open || !activeItem) {
      setConnector(null);
      return;
    }
    const measure = () => {
      const source = document.querySelector<HTMLElement>(`[data-curatorial-source="${activeItem.product_id}"]`);
      if (!source) {
        setConnector(null);
        return;
      }
      const rect = source.getBoundingClientRect();
      const drawerTop = drawerRef.current?.getBoundingClientRect().top ?? window.innerHeight;
      if (rect.bottom <= 0 || rect.top >= drawerTop) {
        setConnector(null);
        return;
      }
      const firstRecommendation = firstRecommendationRef.current?.getBoundingClientRect();
      setConnector({
        x1: rect.left + rect.width / 2,
        y1: Math.min(rect.bottom, drawerTop - 18),
        x2: firstRecommendation ? firstRecommendation.left + Math.min(56, firstRecommendation.width / 2) : Math.max(112, window.innerWidth * 0.24),
        y2: firstRecommendation ? firstRecommendation.top + 18 : drawerTop,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [activeItem, heightIndex, open, visibleRecommendations]);

  const openRecommendation = async (rec: Recommendation) => {
    setOpeningId(rec.product_id);
    setError(null);
    try {
      const { data: direct } = await supabase
        .from("trade_products")
        .select("id")
        .eq("id", rec.product_id)
        .maybeSingle();
      if (direct?.id) {
        window.location.assign(`/trade/products/${direct.id}`);
        return;
      }
      const { data: twin } = await supabase
        .from("trade_products")
        .select("id")
        .eq("source_pick_id", rec.product_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      window.location.assign(`/trade/products/${twin?.id || rec.product_id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The specification could not be opened.");
      setOpeningId(null);
    }
  };

  const scroll = (direction: -1 | 1) => {
    streamRef.current?.scrollBy(docked ? { top: direction * 360, behavior: "smooth" } : { left: direction * 360, behavior: "smooth" });
  };

  if (!open && !docked) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-auto rounded-none border-t border-foreground bg-background px-4 py-3 font-body text-[10px] uppercase tracking-[0.15em] text-foreground hover:bg-background md:bottom-7 md:right-8"
      >
        <span className="h-1.5 w-1.5 bg-foreground" />
        AI Curatorial Assistant // Co-Designer
      </Button>
    );
  }

  const height = HEIGHTS[heightIndex];
  const status = loading ? "Analysis in progress" : error ? "Review required" : "Curation ready";

  return (
    <>
    {connector && open && !docked && (
      <svg className="pointer-events-none fixed inset-0 z-[51] h-full w-full" aria-hidden="true">
        <line
          x1={connector.x1}
          y1={connector.y1}
          x2={connector.x2}
          y2={connector.y2}
          className="stroke-foreground/20"
          strokeWidth="1"
          strokeDasharray="1 6"
          strokeLinecap="round"
        />
        <circle cx={connector.x1} cy={connector.y1} r="2.5" className="fill-background stroke-foreground/35" strokeWidth="1" />
        <circle cx={connector.x2} cy={connector.y2} r="2.5" className="fill-background stroke-foreground/35" strokeWidth="1" />
      </svg>
    )}
    <section
      ref={drawerRef}
      aria-label="AI Curatorial Assistant"
      aria-hidden={docked && !open}
      className={docked
        ? "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
        : "fixed inset-x-0 bottom-0 z-50 flex flex-col border-t border-border bg-background transition-[height] duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]"}
      style={docked ? undefined : { height, maxHeight: "calc(100dvh - 48px)" }}
    >
      <div className={`flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 md:px-8 ${docked ? "min-h-0 py-3" : "min-h-16"}`}>
        <div className="min-w-0">
          <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
            Status // {status}
          </p>
          <p data-curating-for className="mt-2 inline-block border border-foreground/80 px-2 py-0.5 font-body text-[9px] uppercase tracking-[0.15em] text-foreground">
            Curating pairings for: {activeItem?.name || "the project composition"}
          </p>
          <h2 className="mt-1 font-display text-xl leading-tight text-foreground md:text-2xl">
            AI Curatorial Assistant <span className="font-body text-[10px] uppercase tracking-[0.15em]">// Co-Designer</span>
          </h2>
          <p className="mt-1 font-body text-[10px] uppercase leading-relaxed tracking-[0.15em] text-foreground">
            {isClientMode
              ? "AI Curation: Aesthetic pairings selected to balance the textural composition."
              : `Curating complementary pieces for ${activeItem?.name || "the active composition"}.`}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {!docked && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setHeightIndex((value) => Math.min(HEIGHTS.length - 1, value + 1))}
                disabled={heightIndex === HEIGHTS.length - 1}
                aria-label="Expand curatorial assistant"
                className="rounded-none text-muted-foreground"
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setHeightIndex((value) => Math.max(0, value - 1))}
                disabled={heightIndex === 0}
                aria-label="Reduce curatorial assistant"
                className="rounded-none text-muted-foreground"
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close curatorial assistant"
                className="rounded-none text-muted-foreground"
              >
                <X />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={`flex min-h-0 flex-1 flex-col ${docked ? "overflow-y-auto" : "md:flex-row"}`}>
        <div className={docked ? "border-b border-border px-4 py-4 md:px-6" : "border-b border-border px-4 py-4 md:w-56 md:shrink-0 md:border-b-0 md:border-r md:px-6"}>
          <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Active reference</p>
          <p className="mt-2 font-display text-lg leading-tight text-foreground">{activeItem?.name || "Project composition"}</p>
          <p className="mt-1 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{activeItem?.designer}</p>
          {items.length > 1 && (
            <select
              value={activeItem?.product_id || ""}
              onChange={(event) => onActiveItemChange(event.target.value)}
              aria-label="Active source piece"
              className="mt-4 w-full border-0 border-b border-border bg-transparent py-2 font-body text-[10px] uppercase tracking-[0.12em] text-foreground focus:outline-hidden"
            >
              {items.map((item) => <option key={item.product_id} value={item.product_id}>{item.name}</option>)}
            </select>
          )}
          <p className="mt-4 font-body text-[10px] leading-relaxed tracking-[0.05em] text-muted-foreground">
            {isClientMode
              ? "Reading proportion, silhouette, material harmony, and spatial balance."
              : "Reading composition, trade opportunity, and programme compatibility."}
          </p>
        </div>

        <div className={cn("min-w-0 flex-1 px-4 py-4 md:px-6", focused ? "overflow-visible" : "overflow-hidden")}>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Curation stream</p>
            <div className={focused ? "hidden" : "flex"}>
              <Button type="button" variant="ghost" size="icon" onClick={() => scroll(-1)} aria-label="Previous recommendations" className="h-7 w-7 rounded-none text-muted-foreground"><ArrowLeft /></Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => scroll(1)} aria-label="Next recommendations" className="h-7 w-7 rounded-none text-muted-foreground"><ArrowRight /></Button>
            </div>
          </div>

          <div role="group" aria-label="Pairing collection" className="mb-4 flex flex-wrap gap-2">
            <Button variant={favoritesOnly ? "ghost" : "outline"} size="sm" aria-pressed={!favoritesOnly} onClick={() => { setFavoritesOnly(false); setCategoryFilter(""); setFinishFilter(""); }} className="rounded-none font-body text-[10px] uppercase tracking-[0.12em]">All pairings</Button>
            <Button variant={favoritesOnly ? "outline" : "ghost"} size="sm" aria-pressed={favoritesOnly} onClick={() => { setFavoritesOnly(true); setCategoryFilter(""); setFinishFilter(""); }} className="rounded-none font-body text-[10px] uppercase tracking-[0.12em]"><Bookmark className="h-3 w-3" />Saved pairings ({savedRecommendations.length})</Button>
          </div>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <p id="curation-category-label" className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Category</p>
              <Select value={categoryFilter || "all"} onValueChange={value => setCategoryFilter(value === "all" ? "" : value)} disabled={loading || !streamRecommendations.length}>
                <SelectTrigger aria-labelledby="curation-category-label" className="rounded-none font-body text-[10px] uppercase tracking-[0.12em]"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[100] rounded-none">
                  <SelectItem value="all">All categories</SelectItem>
                  {filterOptions.categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <p id="curation-finish-label" className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Finish</p>
              <Select value={finishFilter || "all"} onValueChange={value => setFinishFilter(value === "all" ? "" : value)} disabled={loading || !streamRecommendations.length}>
                <SelectTrigger aria-labelledby="curation-finish-label" className="rounded-none font-body text-[10px] uppercase tracking-[0.12em]"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[100] rounded-none">
                  <SelectItem value="all">All finishes</SelectItem>
                  {filterOptions.finishes.map(finish => <SelectItem key={finish} value={finish} className="capitalize">{finish}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-h-8 items-center justify-between gap-3 sm:col-span-2">
              <p role="status" aria-live="polite" className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{loading ? "Reviewing pairings" : `${visibleRecommendations.length} of ${streamRecommendations.length} pairings`}</p>
              {(categoryFilter || finishFilter) && <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter(""); setFinishFilter(""); }} className="h-8 rounded-none px-2 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground"><X className="h-3 w-3" />Clear filters</Button>}
            </div>
          </div>

          {loading ? (
            <div className="flex h-40 items-center gap-3 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing the composition
            </div>
          ) : visibleRecommendations.length ? (
            <div ref={streamRef} className={docked ? "flex flex-col gap-6 pb-3" : "flex h-full snap-x gap-5 overflow-x-auto pb-3 [scrollbar-width:thin]"}>
              {visibleRecommendations.map((rec, index) => {
                const rationale = rec.reason;
                return (
                  <article
                    ref={index === 0 ? firstRecommendationRef : undefined}
                    key={rec.product_id}
                    className={focused ? "group relative grid w-full shrink-0 grid-cols-[120px_minmax(0,1fr)] gap-5 border-b border-border pb-6 sm:grid-cols-[180px_minmax(0,1fr)]" : docked ? "group relative flex w-full shrink-0 flex-col border-b border-border pb-4" : "group relative flex h-full w-[140px] shrink-0 snap-start flex-col md:w-[170px]"}
                    onMouseEnter={() => onRecommendationHover(true)}
                    onMouseLeave={() => onRecommendationHover(false)}
                    onFocus={() => onRecommendationHover(true)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) onRecommendationHover(false);
                    }}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void openRecommendation(rec)}
                      disabled={openingId === rec.product_id}
                      className={cn("relative block w-full cursor-pointer overflow-hidden rounded-none bg-transparent p-0 hover:bg-transparent", focused ? "row-span-3 h-[140px] sm:h-[180px]" : "h-[110px] md:h-[140px]")}
                      aria-label={`View ${rec.title}`}
                    >
                      {rec.image_url ? (
                        <img src={rec.image_url} alt={`${rec.title} by ${rec.brand}`} loading="lazy" className="h-full w-full object-contain transition-transform duration-300 hover:scale-[1.03] motion-reduce:transition-none" />
                      ) : (
                        <span className="grid h-full place-items-center font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Image on request</span>
                      )}
                    </Button>
                    <p className={cn("mt-2 font-body text-[10px] uppercase leading-relaxed tracking-[0.15em] text-muted-foreground", !focused && "truncate")}>
                      {rec.title}
                    </p>
                    {focused && <div className="min-w-0 space-y-3 text-muted-foreground"><div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-body text-[10px] uppercase leading-relaxed tracking-[0.15em]"><span>{rec.brand}</span><span className="border border-border px-2 py-1 text-[9px]">{rec.editorial_tag}</span></div><p className="font-body text-sm leading-relaxed">{rationale}</p></div>}
                    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", focused && "col-start-2")}>
                    <Button type="button" variant="ghost" size="sm" aria-label={`${favoriteIds.has(rec.product_id) ? "Remove saved pairing" : "Save pairing"}: ${rec.title}`} aria-pressed={favoriteIds.has(rec.product_id)} disabled={favoritePending || loading} onClick={() => void toggleFavorite(rec)} className="min-h-10 rounded-none px-0 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground hover:bg-transparent hover:text-foreground">
                      <Bookmark className={cn("h-3.5 w-3.5", favoriteIds.has(rec.product_id) && "fill-current")} />{favoriteIds.has(rec.product_id) ? "Saved" : "Save pairing"}
                    </Button>
                    <StudioPairingFolderPicker projectId={projectId} productId={rec.product_id} productName={rec.title} onSaved={onCompositionChanged}
                      className={cn("mt-1 h-auto justify-start rounded-none p-0 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70 transition-opacity hover:bg-transparent hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-100", focused ? "col-start-2 min-h-10 justify-self-start text-left opacity-100" : "opacity-0")}
                    />
                    </div>
                  </article>

                );
              })}
            </div>
          ) : (
            <p className="py-10 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{error || (streamRecommendations.length ? "No pairings match these filters." : favoritesOnly ? "No saved pairings for this piece yet." : activeItem ? "No complementary pairings are currently available." : "Add pieces to this project to begin a curatorial analysis.")}</p>
          )}
          {error && streamRecommendations.length > 0 && <p role="alert" className="mt-2 font-body text-[10px] text-destructive">{error}</p>}
        </div>
      </div>
    </section>
    </>
  );
}
