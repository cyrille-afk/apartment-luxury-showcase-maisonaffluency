import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type CuratorialSourceItem = {
  product_id: string;
  name: string;
  designer: string;
  image_url: string | null;
};

type Recommendation = {
  product_id: string;
  score: number;
  reason: string;
  title: string;
  subtitle: string;
  image_url: string;
  category: string;
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

function clientReason(rec: Recommendation, sourceName: string) {
  const category = rec.category ? rec.category.toLowerCase() : "piece";
  return `Suggested ${category} for the ${sourceName}, balancing its silhouette through complementary scale, material tone, and spatial rhythm.`;
}

function recommendationContext(rec: Recommendation, sourceName: string) {
  const descriptor = `${rec.category} ${rec.title} ${rec.subtitle}`.toLowerCase();

  if (/mirror|wall|tapestry|panel|screen|artwork/.test(descriptor)) {
    return {
      label: "Material Harmony // Complementary Material Accent",
      explanation: `Sourced to echo the organic textures and stone or wood grain finishes present in the ${sourceName} composition.`,
    };
  }
  if (/rug|carpet|textile|fabric|upholster|cushion|throw/.test(descriptor)) {
    return {
      label: "Texture Balance // Dialogue with Fabric",
      explanation: "Selected to build a measured dialogue between the existing upholstery, tactile depth, and surrounding surface tones.",
    };
  }
  if (/table|stool|console|desk|pedestal|bench/.test(descriptor)) {
    return {
      label: "Spatial Composition // Pairing Recommendation",
      explanation: "Positioned as a proportional counterpoint that reinforces circulation, usable scale, and the rhythm of the furniture plan.",
    };
  }
  if (/lamp|light|sconce|chandelier|pendant/.test(descriptor)) {
    return {
      label: "Light Balance // Ambient Counterpoint",
      explanation: "Chosen to add a controlled layer of illumination while preserving the composition's material warmth and visual hierarchy.",
    };
  }
  return {
    label: "Form Dialogue // Complementary Silhouette",
    explanation: "Selected as a complementary form whose scale, silhouette, and material presence strengthen the wider composition.",
  };
}

export function ProjectCuratorialGuide({
  projectId,
  projectName,
  items,
  activeItemId,
  isClientMode,
  docked = false,
  open: controlledOpen,
  onOpenChange,
  onActiveItemChange,
  onCompositionChanged,
  onRecommendationHover,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setInternalOpen(value);
  };
  const [heightIndex, setHeightIndex] = useState(1);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [boardId, setBoardId] = useState<string | null>(null);
  const [connector, setConnector] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const firstRecommendationRef = useRef<HTMLElement | null>(null);

  const activeItem = useMemo(
    () => items.find((item) => item.product_id === activeItemId) || items[0] || null,
    [activeItemId, items],
  );

  useEffect(() => {
    if (!activeItemId && items[0]) onActiveItemChange(items[0].product_id);
  }, [activeItemId, items, onActiveItemChange]);

  useEffect(() => {
    if (!open || items.length === 0) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: invokeError } = await supabase.functions.invoke("board-recommendations", {
        body: { product_ids: items.map((item) => item.product_id).slice(0, 20), source: "mood_board" },
      });
      if (cancelled) return;
      if (invokeError) {
        setError(invokeError.message || "Curation analysis is temporarily unavailable.");
        setRecommendations([]);
      } else {
        setRecommendations((data?.recommendations || []) as Recommendation[]);
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, items]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
  }, [activeItem, heightIndex, open, recommendations]);

  const resolveBoard = async () => {
    if (boardId) return boardId;
    const { data: existing, error: boardError } = await supabase
      .from("client_boards")
      .select("id")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (boardError) throw boardError;
    if (existing?.id) {
      setBoardId(existing.id);
      return existing.id;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("Sign in is required to update this composition.");
    const { data: created, error: createError } = await supabase
      .from("client_boards")
      .insert({
        project_id: projectId,
        title: `${projectName} — Curatorial Composition`,
        client_name: "",
        user_id: userId,
      })
      .select("id")
      .single();
    if (createError) throw createError;
    setBoardId(created.id);
    return created.id;
  };

  const addToComposition = async (rec: Recommendation) => {
    setAddingId(rec.product_id);
    setError(null);
    try {
      const targetBoardId = await resolveBoard();
      let productId = rec.product_id;
      const { data: direct } = await supabase
        .from("trade_products")
        .select("id")
        .eq("id", rec.product_id)
        .maybeSingle();
      if (!direct?.id) {
        const { data: twin } = await supabase
          .from("trade_products")
          .select("id")
          .eq("source_pick_id", rec.product_id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (!twin?.id) throw new Error("This piece is not yet available in the trade catalogue.");
        productId = twin.id;
      }
      const { data: duplicate } = await supabase
        .from("client_board_items")
        .select("id")
        .eq("board_id", targetBoardId)
        .eq("product_id", productId)
        .maybeSingle();
      if (!duplicate) {
        const { error: insertError } = await supabase
          .from("client_board_items")
          .insert({ board_id: targetBoardId, product_id: productId, sort_order: items.length });
        if (insertError) throw insertError;
      }
      setAddedIds((current) => new Set(current).add(rec.product_id));
      onCompositionChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The piece could not be added.");
    } finally {
      setAddingId(null);
    }
  };

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
    streamRef.current?.scrollBy({ left: direction * 360, behavior: "smooth" });
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
    {docked && !open && (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-2 bg-background font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        >
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
          [ Activate AI Curatorial Concierge ]
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden lg:absolute lg:bottom-8 lg:left-1/2 lg:z-50 lg:flex lg:-translate-x-1/2 lg:items-center lg:gap-3 lg:rounded-full lg:border lg:border-[#E5E5E5] lg:bg-white lg:px-6 lg:py-3.5 lg:font-mono lg:text-[10px] lg:uppercase lg:tracking-[0.2em] lg:text-foreground/80 lg:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] lg:backdrop-blur-sm lg:transition-all lg:duration-300 lg:ease-out lg:hover:-translate-y-1 lg:hover:text-foreground lg:hover:border-foreground/40 lg:hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.12)]"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current ring-1 ring-current/30" aria-hidden="true" />
          Activate AI Concierge Workspace
        </button>
      </>
    )}
    {connector && open && (
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
          <h2 className="mt-1 truncate font-display text-xl text-foreground md:text-2xl">
            AI Curatorial Assistant <span className="font-body text-[10px] uppercase tracking-[0.15em]">// Co-Designer</span>
          </h2>
          <p className="mt-1 truncate font-body text-[10px] uppercase tracking-[0.15em] text-foreground">
            {isClientMode
              ? "AI Curation: Aesthetic pairings selected to balance the textural composition."
              : `AI Curation: Sourcing active wood variants and high-margin pairs matching ${activeItem?.name || "the active composition"}.`}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {docked && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="h-auto rounded-none px-2 py-1 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              [ Dismiss AI Concierge ]
            </Button>
          )}
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

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="border-b border-border px-4 py-4 md:w-56 md:shrink-0 md:border-b-0 md:border-r md:px-6">
          <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Active reference</p>
          <p className="mt-2 font-display text-lg leading-tight text-foreground">{activeItem?.name || "Project composition"}</p>
          <p className="mt-1 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{activeItem?.designer}</p>
          {items.length > 1 && (
            <select
              value={activeItem?.product_id || ""}
              onChange={(event) => onActiveItemChange(event.target.value)}
              aria-label="Active source piece"
              className="mt-4 w-full border-0 border-b border-border bg-transparent py-2 font-body text-[10px] uppercase tracking-[0.12em] text-foreground focus:outline-none"
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

        <div className="min-w-0 flex-1 overflow-hidden px-4 py-4 md:px-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Curation stream</p>
            <div className="flex">
              <Button type="button" variant="ghost" size="icon" onClick={() => scroll(-1)} aria-label="Previous recommendations" className="h-7 w-7 rounded-none text-muted-foreground"><ArrowLeft /></Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => scroll(1)} aria-label="Next recommendations" className="h-7 w-7 rounded-none text-muted-foreground"><ArrowRight /></Button>
            </div>
          </div>

          {loading ? (
            <div className="flex h-40 items-center gap-3 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing the composition
            </div>
          ) : recommendations.length ? (
            <div ref={streamRef} className="flex h-full snap-x gap-5 overflow-x-auto pb-3 [scrollbar-width:thin]">
              {recommendations.map((rec, index) => {
                const context = recommendationContext(rec, activeItem?.name || "active piece");
                const briefReason = isClientMode ? clientReason(rec, activeItem?.name || "composition") : rec.reason;
                const rationale = `${briefReason} ${context.explanation}`;
                const added = addedIds.has(rec.product_id);
                return (
                  <article
                    ref={index === 0 ? firstRecommendationRef : undefined}
                    key={rec.product_id}
                    title={rationale}
                    className="group relative flex h-full w-[140px] shrink-0 snap-start flex-col md:w-[170px]"
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
                      className="relative block h-[110px] w-full rounded-none bg-transparent p-0 hover:bg-transparent md:h-[140px]"
                      aria-label={`${Math.round(rec.score)}% match — view curation intent for ${rec.title}`}
                    >
                      {rec.image_url ? (
                        <img src={rec.image_url} alt={`${rec.title} by ${rec.brand}`} loading="lazy" className="h-full w-full object-contain" />
                      ) : (
                        <span className="grid h-full place-items-center font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Image on request</span>
                      )}
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 px-2 text-center font-body text-[9px] uppercase leading-relaxed tracking-[0.15em] text-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
                        {Math.round(rec.score)}% Match // View Curation Intent
                      </span>
                    </Button>
                    <p className="mt-2 truncate font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                      {rec.title}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void addToComposition(rec)}
                      disabled={addingId === rec.product_id || added}
                      className="mt-1 h-auto justify-start rounded-none p-0 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70 opacity-0 transition-opacity hover:bg-transparent hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-100"
                    >
                      {addingId === rec.product_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      {added ? "Added" : "Add"}
                    </Button>
                  </article>

                );
              })}
            </div>
          ) : (
            <p className="py-10 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{error || "Add pieces to this project to begin a curatorial analysis."}</p>
          )}
          {error && recommendations.length > 0 && <p role="alert" className="mt-2 font-body text-[10px] text-destructive">{error}</p>}
        </div>
      </div>
    </section>
    </>
  );
}
