import { invokeWithAuthRetry } from "@/lib/invokeWithAuthRetry";
import { Helmet } from "react-helmet-async";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { Search, Loader2, Plus, X, Heart, FolderOpen, LayoutGrid, Sparkles, RefreshCw, Pin } from "lucide-react";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { MakerAZPicker } from "@/components/trade/MakerAZPicker";
import { MoodBoardBudgetControls, MoodBoardBudgetBar } from "@/components/trade/MoodBoardBudgetControls";
import { convertMoodBudget, emptyMoodBudget, fitsMoodBudget, formatMoodMoney, isMoodCurrency, moodBudgetLedger, moodPrices, type MoodBudgetSettings, type MoodCurrency } from "@/lib/moodBoardBudget";
import { fetchMoodBoardDetails } from "@/lib/moodBoardDetails";
import { getFxRate } from "@/lib/fxRates";
import { loadAccountCurrency } from "@/hooks/useTradeDisplayCurrency";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MoodBoardActions } from "@/components/trade/MoodBoardActions";
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { filterMoodBoardCatalog, moodBoardCategories, shouldRecommendMoodBoard, type MoodBoardCategory } from "@/lib/moodBoardCatalog";
import { complementPage, nextComplementPage, COMPLEMENT_PAGE_SIZE } from "@/lib/moodBoardRecommendationPages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PickerFilter = "all" | "favourites" | "board";

const BOARD_STORAGE_KEY_BASE = "mood-board-items";
const storageKeyFor = (projectId: string | null) =>
  projectId ? `${BOARD_STORAGE_KEY_BASE}:${projectId}` : BOARD_STORAGE_KEY_BASE;

function loadBoardFromStorage(projectId: string | null): any[] {
  try {
    const stored = localStorage.getItem(storageKeyFor(projectId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

interface MoodRec {
  product_id: string;
  score: number;
  reason: string;
  title: string;
  subtitle: string;
  image_url: string;
  category: string;
  brand: string;
}

export default function TradeMoodBoards() {
  const { user } = useAuth();
  const { discountPct } = useTradeDiscount();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const { clientSafe } = useClientSafeMode();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MoodBoardCategory>("All");
  const [maker, setMaker] = useState("");
  const [visibleCount, setVisibleCount] = useState(40);
  const requestRevision = useRef(0);
  const [board, setBoard] = useState<any[]>([]);
  const [budgetSettings, setBudgetSettings] = useState<MoodBudgetSettings>(emptyMoodBudget);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = `ma-mood-workspace-v1:${user?.id ?? "pending"}:${projectId ?? "standalone"}`;
  const restoredProjectRef = useRef(false);
  const [filter, setFilter] = useState<PickerFilter>(projectId ? "board" : "all");
  const [recommendations, setRecommendations] = useState<MoodRec[]>([]);
  const [refreshPage, setRefreshPage] = useState(0);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const prevBoardIdsRef = useRef<string>("");
  const seededProjectRef = useRef<string | null>(null);
  const detailIds = useMemo(() => [...new Set([...board.map(b => b.id), ...recommendations.map(r => r.product_id)])].sort(), [board, recommendations]);
  const { data: details = new Map(), isFetching: pricingPending, isError: pricingFailed } = useQuery({
    queryKey: ["mood-board-live-details", user?.id, detailIds], enabled: !!user && detailIds.length > 0,
    queryFn: () => fetchMoodBoardDetails(detailIds),
  });
  const prices = useMemo(() => new Map(detailIds.map(id => [id, moodPrices(details.get(id)?.retailCents ?? null, discountPct)])), [detailIds, details, discountPct]);
  const boardCurrency: MoodCurrency = budgetSettings.currency ?? "EUR";
  const { data: eurRate = 1, isFetching: ratePending } = useQuery({ queryKey: ["mood-board-fx", boardCurrency], queryFn: () => getFxRate("EUR", boardCurrency), staleTime: 10 * 60_000 });
  const money = (eurCents: number) => formatMoodMoney(Math.round(eurCents * eurRate), boardCurrency);
  const ledger = moodBudgetLedger(board.map(item => ({ ...item, subcategory: details.get(item.id)?.subcategory })), prices, budgetSettings, eurRate);
  const affordableRecommendations = recommendations.filter(rec => fitsMoodBudget({ ...rec, subcategory: details.get(rec.product_id)?.subcategory }, prices.get(rec.product_id), ledger, budgetSettings, eurRate));
  const changeBoardCurrency = async (next: MoodCurrency) => {
    if (next === boardCurrency) return;
    const factor = await getFxRate(boardCurrency, next);
    setBudgetSettings(s => convertMoodBudget(s, next, factor));
  };
  // Boards without a chosen currency default to the project's, then the account's preferred currency, else EUR.
  useEffect(() => {
    if (!draftReady || !user || budgetSettings.currency) return;
    let cancelled = false;
    void (async () => {
      let pick: unknown = null;
      if (projectId) { const { data } = await supabase.from("projects").select("ceiling_currency").eq("id", projectId).maybeSingle(); pick = data?.ceiling_currency; }
      if (!isMoodCurrency(pick)) pick = await loadAccountCurrency();
      const next: MoodCurrency = isMoodCurrency(pick) ? pick : "EUR";
      if (cancelled) return;
      const factor = next === "EUR" ? 1 : await getFxRate("EUR", next);
      if (!cancelled) setBudgetSettings(s => s.currency ? s : convertMoodBudget(s, next, factor));
    })();
    return () => { cancelled = true; };
  }, [draftReady, user?.id, projectId, budgetSettings.currency]);
  const displayedRecommendations = complementPage(affordableRecommendations, refreshPage);
  useEffect(() => { setRefreshPage(0); }, [budgetSettings.totalEur, budgetSettings.caps]);


  const { data: projectTearsheetProducts = [], isLoading: loadingProjectTearsheetProducts } = useQuery({
    queryKey: ["mood-board-tearsheet-products", projectId, user?.id],
    enabled: !!projectId && !!user,
    queryFn: async () => {
      const ids = new Set<string>();
      const [quotesRes, boardsRes] = await Promise.all([
        supabase.from("trade_quotes").select("id").eq("project_id", projectId || ""),
        supabase.from("client_boards").select("id").eq("project_id", projectId || ""),
      ]);

      const quoteIds = (quotesRes.data || []).map((q: any) => q.id);
      const boardIds = (boardsRes.data || []).map((b: any) => b.id);
      const [qItems, bItems] = await Promise.all([
        quoteIds.length
          ? supabase.from("trade_quote_items").select("product_id").in("quote_id", quoteIds)
          : Promise.resolve({ data: [] as any[] }),
        boardIds.length
          ? supabase.from("client_board_items").select("product_id").in("board_id", boardIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      (qItems.data || []).forEach((r: any) => r.product_id && ids.add(r.product_id));
      (bItems.data || []).forEach((r: any) => r.product_id && ids.add(r.product_id));
      const idArr = Array.from(ids);
      if (!idArr.length) return [];

      const [tradeRes, curatorRes] = await Promise.all([
        supabase.from("trade_products").select("id, product_name, brand_name, image_url, category, source_pick_id").in("id", idArr).not("image_url", "is", null),
        supabase.from("designer_curator_picks").select("id, title, image_url, category, designer_id").in("id", idArr).not("image_url", "is", null),
      ]);

      const designerIds = [...new Set((curatorRes.data || []).map((p: any) => p.designer_id).filter(Boolean))];
      let designerMap = new Map<string, string>();
      if (designerIds.length > 0) {
        const { data: designers } = await supabase.from("designers").select("id, name").in("id", designerIds);
        designerMap = new Map((designers || []).map((d: any) => [d.id, d.name]));
      }

      // Dedupe: when a trade_products mirror points at a curator pick that is
      // ALSO in this id set (quote item references both twins), drop the pick
      // and keep the trade row — that's what FF&E/quotes/boards actually use.
      const mirroredPickIds = new Set<string>(
        (tradeRes.data || []).map((p: any) => p.source_pick_id).filter(Boolean),
      );

      const byId = new Map<string, any>();
      (tradeRes.data || []).forEach((p: any) => byId.set(p.id, {
        id: p.id,
        product_name: p.product_name,
        brand_name: p.brand_name,
        image_url: p.image_url,
        category: p.category,
        source: "trade",
      }));
      (curatorRes.data || []).forEach((p: any) => {
        if (mirroredPickIds.has(p.id)) return; // already represented by its trade twin
        byId.set(p.id, {
          id: p.id,
          product_name: p.title,
          brand_name: designerMap.get(p.designer_id) || "Unknown",
          image_url: p.image_url,
          category: p.category || "",
          source: "curator",
        });
      });

      return idArr.map((id) => byId.get(id)).filter(Boolean);
    },
  });

  // Project mood boards are seeded from that project's tearsheet products, not legacy local storage.
  useEffect(() => {
    if (!user) return;
    setDraftReady(false);
    let saved: { items?: any[]; settings?: MoodBudgetSettings } | null = null;
    try { saved = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch { /* unavailable */ }
    restoredProjectRef.current = Array.isArray(saved?.items);
    setBoard(saved?.items ?? (projectId ? [] : loadBoardFromStorage(null)));
    setBudgetSettings(saved?.settings ?? emptyMoodBudget());
    setDraftReady(true);
    prevBoardIdsRef.current = "";
    seededProjectRef.current = null;
    setRecommendations([]);
    setRecError(null);
  }, [projectId, user?.id, draftKey]);

  useEffect(() => {
    if (!projectId || !draftReady || restoredProjectRef.current || loadingProjectTearsheetProducts) return;
    const seedKey = `${projectId}:${projectTearsheetProducts.map((p: any) => p.id).sort().join(",")}`;
    if (seededProjectRef.current === seedKey) return;
    seededProjectRef.current = seedKey;
    setBoard(projectTearsheetProducts);
  }, [projectId, draftReady, loadingProjectTearsheetProducts, projectTearsheetProducts]);

  // Persist the free-form builder only; project mode should always reflect project tearsheets.
  useEffect(() => {
    if (!draftReady || !user || (projectId && !restoredProjectRef.current && loadingProjectTearsheetProducts)) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ items: board, settings: budgetSettings })); }
    catch { toast.error("This browser couldn't save the mood board draft. Save to project to keep your pieces."); }
  }, [board, budgetSettings, draftReady, draftKey, user?.id, projectId, loadingProjectTearsheetProducts]);

  const fetchRecommendations = useCallback(async (productIds: string[]) => {
    if (!shouldRecommendMoodBoard(productIds.length)) return;
    const revision = ++requestRevision.current;
    setRecLoading(true);
    setRecError(null);
    try {
      const { data, error } = await invokeWithAuthRetry("board-recommendations", { product_ids: productIds, anchor_ids: budgetSettings.anchors.filter(id => productIds.includes(id)), room_type: budgetSettings.roomType, source: projectId ? "project_tearsheet_mood_board" : "mood_board", project_id: projectId, include_pool: true });
      if (revision !== requestRevision.current) return;
      if (error) throw error;
      if (data?.recommendations) {
        const recs: MoodRec[] = data.recommendations;
        setRecommendations(recs);
        setRefreshPage(0);

        // Concierge steps in to narrate WHY these complements were chosen.
        // We only fire when there's something meaningful to say.
        if (recs.length > 0) {
          const top = recs.slice(0, 6);
          const bullets = top
            .map((r) => `- **${r.title}**${r.brand ? ` · ${r.brand}` : ""} — ${r.reason}`)
            .join("\n");
          const message =
            `${projectId ? "I used this project's tearsheet products as the anchors and" : "I've"} pulled ${top.length} complement${top.length === 1 ? "" : "s"} for the mood you're building. ` +
            `Here's why each was chosen:\n\n${bullets}\n\n` +
            `Tap any thumbnail to drop it onto the board, or ask me to refine the direction (warmer palette, smaller scale, more sculptural, etc.).`;
          window.dispatchEvent(
            new CustomEvent("concierge:stage", {
              detail: {
                stage: "Tearsheet",
                message,
                  openPanel: !!projectId,
                actions: [
                  { label: "Make it warmer", prompt: "Suggest complements with a warmer, earthier palette for my current mood board." },
                  { label: "More sculptural", prompt: "Replace the current complements with more sculptural, statement pieces." },
                  { label: "Different scale", prompt: "Suggest complements at a different scale (smaller accent pieces) for my mood board." },
                ],
              },
            }),
          );
        }
      }
    } catch (err: any) {
      if (revision !== requestRevision.current) return;
      console.warn("Mood board recommendations unavailable:", err?.message);
      setRecError("Could not generate suggestions");
    } finally {
      if (revision === requestRevision.current) setRecLoading(false);
    }
  }, [projectId, budgetSettings.anchors, budgetSettings.roomType]);

  // Invalidate in-flight results on every composition change, including removal.
  useEffect(() => {
    const currentIds = board.map(b => b.id).sort().join(",");
    prevBoardIdsRef.current = currentIds;
    requestRevision.current += 1;
    setRecommendations([]);
    setRefreshPage(0);
    setRecError(null);
    if (!shouldRecommendMoodBoard(board.length)) {
      setRecLoading(false);
      return;
    }
    setRecLoading(true);
    const timer = setTimeout(() => fetchRecommendations(board.map(b => b.id)), 300);
    return () => { clearTimeout(timer); requestRevision.current += 1; };
  }, [board, fetchRecommendations]);

  // All products: merge trade_products + designer_curator_picks
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["mood-board-products-merged", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const trade: any[] = [];
      const curator: any[] = [];
      await Promise.all([
        (async () => {
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase.from("trade_products")
              .select("id, product_name, brand_name, image_url, category, subcategory, source_pick_id")
              .eq("is_active", true).eq("is_hidden", false).not("image_url", "is", null)
              .order("id").range(offset, offset + 499);
            if (error) throw error;
            trade.push(...(data || []));
            if (!data || data.length < 500) break;
          }
        })(),
        (async () => {
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase.from("designer_curator_picks")
              .select("id, title, image_url, category, subcategory, designer_id")
              .eq("is_hidden", false).not("image_url", "is", null)
              .order("id").range(offset, offset + 499);
            if (error) throw error;
            curator.push(...(data || []));
            if (!data || data.length < 500) break;
          }
        })(),
      ]);

      // Resolve designer names for curator picks
      const designerIds = [...new Set((curator || []).map((p) => p.designer_id))];
      let designerMap = new Map<string, string>();
      if (designerIds.length > 0) {
        const { data: designers } = await supabase
          .from("designers")
          .select("id, name")
          .in("id", designerIds);
        designerMap = new Map((designers || []).map((d) => [d.id, d.name]));
      }

      // Picks that already have a trade mirror — drop them, the trade row wins.
      const mirroredPickIds = new Set<string>(
        (trade || []).map((p: any) => p.source_pick_id).filter(Boolean) as string[],
      );

      const tradeItems = (trade || []).map((p) => ({
        id: p.id,
        product_name: p.product_name,
        brand_name: p.brand_name,
        image_url: p.image_url,
        category: p.category,
        subcategory: p.subcategory || "",
        source: "trade" as const,
      }));

      const curatorItems = (curator || [])
        .filter((p: any) => !mirroredPickIds.has(p.id))
        .map((p) => ({
          id: p.id,
          product_name: p.title,
          brand_name: designerMap.get(p.designer_id) || "Unknown",
          image_url: p.image_url,
          category: p.category || "",
          subcategory: p.subcategory || "",
          source: "curator" as const,
        }));

      // Legacy fallback: any remaining title|brand collision (pre-source_pick_id
      // rows) — prefer the trade entry since that's what tools join through.
      const seen = new Set<string>();
      const merged: Array<{ id: string; product_name: string; brand_name: string; image_url: string | null; category: string; subcategory?: string; source: "trade" | "curator" }> = [];
      for (const item of [...tradeItems, ...curatorItems]) {
        const key = `${item.product_name?.toLowerCase()}|${item.brand_name?.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
      return merged.sort((a, b) => a.brand_name.localeCompare(b.brand_name));
    },
  });

  // User's favourites
  const { data: favouriteProducts = [], isLoading: loadingFavs } = useQuery({
    queryKey: ["mood-board-favourites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: favs } = await supabase
        .from("trade_favorites")
        .select("product_id")
        .eq("user_id", user?.id || "");
      if (!favs?.length) return [];
      const ids = favs.map((f) => f.product_id);
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, category")
        .in("id", ids)
        .not("image_url", "is", null)
        .order("brand_name");
      return data || [];
    },
  });

  // User's board items (from client_boards) — scoped to current project when set
  const { data: boardProducts = [], isLoading: loadingBoards } = useQuery({
    queryKey: ["mood-board-project-items", user?.id, projectId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("client_boards").select("id").eq("user_id", user?.id || "");
      if (projectId) q = q.eq("project_id", projectId);
      const { data: boards } = await q;
      if (!boards?.length) return [];
      const boardIds = boards.map((b) => b.id);
      const { data: items } = await supabase
        .from("client_board_items")
        .select("product_id")
        .in("board_id", boardIds);
      if (!items?.length) return [];
      const productIds = [...new Set(items.map((i) => i.product_id))];
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, category")
        .in("id", productIds)
        .not("image_url", "is", null)
        .order("brand_name");
      return data || [];
    },
  });

  const sourceProducts = filter === "favourites" ? favouriteProducts : filter === "board" ? (projectId ? projectTearsheetProducts : boardProducts) : products;
  const sourceLoading = filter === "favourites" ? loadingFavs : filter === "board" ? (projectId ? loadingProjectTearsheetProducts : loadingBoards) : isLoading;

  const makers = useMemo(() => [...new Set(sourceProducts.map((p: any) => p.brand_name as string).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [sourceProducts]);
  const filtered = filterMoodBoardCatalog(sourceProducts, search, category, maker);
  useEffect(() => { setVisibleCount(40); }, [search, category, maker, filter]);

  const addToBoard = (product: any) => {
    if (board.find((b) => b.id === product.id)) return;
    setBoard((prev) => [...prev, product]);
  };

  const addRecToBoard = (rec: MoodRec) => {
    if (board.find((b) => b.id === rec.product_id)) return;
    setBoard((prev) => [...prev, {
      id: rec.product_id,
      product_name: rec.title,
      brand_name: rec.brand,
      image_url: rec.image_url,
      category: rec.category,
    }]);
    // Remove from recommendations
    setRecommendations((prev) => prev.filter((r) => r.product_id !== rec.product_id));
  };

  const removeFromBoard = (id: string) => {
    setBoard((prev) => prev.filter((p) => p.id !== id));
  };

  const filterOptions: { key: PickerFilter; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All", icon: <LayoutGrid className="h-3 w-3" /> },
    { key: "favourites", label: "Favourites", icon: <Heart className="h-3 w-3" /> },
    { key: "board", label: projectId ? "Tearsheet" : "From Projects", icon: <FolderOpen className="h-3 w-3" /> },
  ];

  return (
    <>
      <Helmet><title>Mood Board — Trade Portal</title></Helmet>
      <div className="mx-auto w-full max-w-6xl space-y-6 [@media(min-width:1440px)]:max-w-[min(90vw,1800px)]">


        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground">Mood Board Builder</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Curate product imagery into collages for early-stage concept pitches.
            </p>
          </div>
          <MoodBoardActions items={board} defaultProjectId={projectId} />
        </div>

        {!clientSafe && <MoodBoardBudgetControls settings={budgetSettings} onChange={setBudgetSettings} onCurrencyChange={c => void changeBoardCurrency(c)} />}

        <div className="flex flex-col gap-6 lg:flex-row [@media(min-width:1440px)]:grid [@media(min-width:1440px)]:grid-cols-[minmax(0,1fr)_320px] [@media(min-width:1440px)]:gap-8">
          {/* Board area */}
          <div className="min-w-0 flex-1 space-y-6">
            <MoodBoardBudgetBar ledger={ledger} pending={pricingPending || ratePending} currency={boardCurrency} />
            {pricingFailed && <p role="alert" className="text-xs text-destructive">Catalogue prices couldn't load. Budget remains unconfirmed.</p>}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">{board.length} item{board.length !== 1 ? "s" : ""} on board</p>
              </div>
              {board.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-lg flex min-h-[20rem] flex-col items-center justify-center py-20 px-6 text-center [@media(min-width:1440px)]:min-h-[34rem]">
                  <div className="relative mb-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/40">
                      <LayoutGrid className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background">
                      <Sparkles className="h-3 w-3 text-primary" />
                    </div>
                  </div>
                  <p className="font-body text-sm text-foreground">Add an anchor piece from the catalog on the right to start your board.</p>
                  <p className="font-body text-xs text-muted-foreground mt-2 max-w-md">
                    Once placed, the AI Curatorial Assistant will automatically suggest complementary furniture, tables, and finishes to build out the room.
                  </p>
                </div>
              ) : (
                <div className={`grid gap-2 ${board.length <= 3 ? "grid-cols-3" : board.length <= 6 ? "grid-cols-3 lg:grid-cols-4" : "grid-cols-4 [@media(min-width:1440px)]:grid-cols-5"}`}>
                  {board.map((item) => (
                    <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                      <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-background/90">
                        <div className="p-3">
                          <p className="font-display text-xs text-foreground truncate">{item.product_name}</p>
                          <p className="font-body text-[10px] text-muted-foreground">{item.brand_name}</p>
                          <p className="mt-1 font-body text-[11px] leading-snug tabular-nums text-foreground" aria-label={`Price for ${item.product_name}`}>
                            {pricingPending || ratePending ? <span className="text-muted-foreground">Loading price…</span>
                              : prices.get(item.id)?.retail != null ? <>RRP {money(prices.get(item.id)?.retail ?? 0)}</>
                              : <span className="text-muted-foreground">Price unconfirmed</span>}
                          </p>
                        </div>
                      </div>
                      {!clientSafe && <Button variant="outline" size="sm"
                        aria-label={`${budgetSettings.anchors.includes(item.id) ? "Unpin" : "Pin"} ${item.product_name} as anchor`}
                        aria-pressed={budgetSettings.anchors.includes(item.id)}
                        onClick={() => setBudgetSettings(s => ({ ...s, anchors: s.anchors.includes(item.id) ? s.anchors.filter(id => id !== item.id) : [...s.anchors, item.id] }))}
                        className="absolute left-2 top-2 h-7 gap-1 bg-background/90 text-foreground px-2 text-[10px] data-[state=on]:border-primary" data-state={budgetSettings.anchors.includes(item.id) ? "on" : "off"}>
                        <Pin className="h-3 w-3" />{budgetSettings.anchors.includes(item.id) ? "Anchor" : "Pin as Anchor"}
                      </Button>}
                      {!clientSafe && <Button variant="ghost" size="icon"
                        aria-label={`Remove ${item.product_name} from board`}
                        onClick={() => removeFromBoard(item.id)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </Button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Recommendations */}
            {!clientSafe && (
              <div className="w-full min-w-0 border-t border-border pt-5" aria-label="Suggested complements">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-sm text-foreground flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Suggested complements
                  </h2>
                  {shouldRecommendMoodBoard(board.length) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => recError
                        ? fetchRecommendations(board.map((b) => b.id))
                        : setRefreshPage(page => nextComplementPage(page, affordableRecommendations.length))}
                      disabled={recLoading || (!recError && affordableRecommendations.length <= COMPLEMENT_PAGE_SIZE)}
                      className="text-[10px] text-muted-foreground h-7 px-2"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${recLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  )}
                </div>

                {!shouldRecommendMoodBoard(board.length) ? (
                  <p className="font-body text-xs text-muted-foreground">
                    Select your first piece from the right-hand panel to generate tailored pairings.
                  </p>
                ) : recLoading || pricingPending ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 w-full">
                    {Array.from({ length: COMPLEMENT_PAGE_SIZE }, (_, i) => (
                      <div key={i} className="min-w-0 animate-pulse">
                        <div className="aspect-square bg-muted rounded-lg mb-1.5" />
                        <div className="h-2.5 w-3/4 bg-muted rounded mb-1" />
                        <div className="h-2 w-1/2 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : recError ? (
                  <p className="font-body text-xs text-muted-foreground">{recError}</p>
                ) : affordableRecommendations.length === 0 ? (
                  <p className="font-body text-xs text-muted-foreground">{ledger.unpriced && ledger.total != null ? "Confirm all board prices before budget-aware pairing." : "No suitable complements within the remaining budget and category caps."}</p>
                ) : (
                  <TooltipProvider delayDuration={120}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 w-full" data-complement-grid>
                      {displayedRecommendations.map((rec) => (
                        <div key={rec.product_id} className="flex min-w-0 flex-col" data-complement-id={rec.product_id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost"
                              onClick={() => addRecToBoard(rec)}
                              aria-label={`Add ${rec.title} to mood board`}
                              className="group h-auto min-w-0 w-full flex-col items-stretch whitespace-normal p-0 text-left"
                            >
                              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-1.5 border border-border group-hover:border-primary/40 transition-colors">
                                {rec.image_url ? (
                                  <img
                                    src={rec.image_url}
                                    alt={rec.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">
                                    No image
                                  </div>
                                )}
                              </div>
                              <p className="w-full font-body text-xs text-foreground truncate">{rec.title}</p>
                              <p className="w-full font-body text-[11px] text-muted-foreground truncate">{rec.brand}</p>
                              <div className="w-full text-[11px] text-foreground">
                                {prices.get(rec.product_id)?.retail != null ? <>RRP {money(prices.get(rec.product_id)?.retail ?? 0)}
                                  <span data-trade-sensitive className="block text-muted-foreground">Trade {money(prices.get(rec.product_id)?.trade ?? 0)}</span></> : <span className="text-muted-foreground">Price unconfirmed</span>}
                              </div>
                              <p className="w-full font-body text-[11px] text-primary/80 leading-snug mt-1 line-clamp-4 break-words">
                                {rec.reason}
                              </p>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="center" className="max-w-xs text-xs leading-relaxed">
                            {rec.reason}
                          </TooltipContent>
                        </Tooltip>
                        <Button variant="ghost" size="sm" onClick={() => addRecToBoard(rec)}
                          aria-label={`Quick add ${rec.title}`}
                          className="mt-auto h-7 self-start px-1 text-[11px] text-muted-foreground hover:text-primary">
                          <Plus className="mr-1 h-3 w-3" /> Add
                        </Button>
                        </div>
                      ))}
                    </div>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>

          {/* Product picker — hidden in Client View so the board presents cleanly */}
          <div hidden={clientSafe} className="w-full shrink-0 space-y-3 lg:w-72 [@media(min-width:1440px)]:w-80">
            {/* Filter toggle */}
            <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Source catalog</p>
            <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg">
              {filterOptions.map((opt) => (
                <Button variant="ghost"
                  key={opt.key}
                  onClick={() => { setFilter(opt.key); setMaker(""); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-auto px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                    filter === opt.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </Button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10 font-body text-sm" />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Product categories">
              {moodBoardCategories.map(value => (
                <Button key={value} size="sm" variant={category === value ? "secondary" : "ghost"}
                  aria-pressed={category === value} onClick={() => setCategory(value)}
                  className="h-7 shrink-0 rounded-full px-2 text-[10px]">{value}</Button>
              ))}
            </div>
            <MakerAZPicker makers={makers} value={maker} onChange={setMaker} />

            <p className="font-body text-[10px] text-muted-foreground">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            </p>

            <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1 [@media(min-width:1440px)]:max-h-[680px]">
              {sourceLoading ? (
                <div className="flex justify-center py-10"><DotCircleLoader size="sm" className="text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <p className="font-body text-xs text-muted-foreground text-center py-8">
                  {filter === "favourites" ? "No favourited products yet." : filter === "board" ? (projectId ? "No products in this project's tearsheet yet." : "No products in your project boards.") : "No products found."}
                </p>
              ) : (
                filtered.slice(0, visibleCount).map((p: any) => {
                  const onBoard = board.find((b) => b.id === p.id);
                  return (
                    <Button variant="ghost"
                      key={p.id}
                      onClick={() => addToBoard(p)}
                      disabled={!!onBoard}
                      className={`h-auto w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${onBoard ? "opacity-40 cursor-default" : "hover:bg-muted/50"}`}
                    >
                      <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                        {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-xs text-foreground truncate">{p.product_name}</p>
                        <p className="font-body text-[10px] text-muted-foreground">{p.brand_name}</p>
                      </div>
                      {!onBoard && <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    </Button>
                  );
                })
              )}
              {!sourceLoading && visibleCount < filtered.length && (
                <Button variant="outline" size="sm" className="w-full font-body text-xs" onClick={() => setVisibleCount(count => count + 40)}>
                  Load more · {filtered.length - visibleCount} remaining
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}