import { Helmet } from "react-helmet-async";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fillTradeProductImageFallbacks } from "@/lib/tradeProductImageFallback";
import { useAuth } from "@/hooks/useAuth";
import { useState, useRef, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FileText, Loader2, Search, Printer, LayoutGrid, Check, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUserBoards } from "@/hooks/useUserBoards";
import { useStudio } from "@/hooks/useStudio";
import { normalizeCategory, normalizeSubcategory, CATEGORY_ORDER, getSubcategoriesForCategory } from "@/lib/productTaxonomy";
import { ProjectPicker } from "@/components/trade/ProjectPicker";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";
import { getConciergeSession, useConciergeSession } from "@/hooks/useConciergeSession";
import { withImperialInline } from "@/lib/formatDimensions";
import { formatLeadTime } from "@/components/trade/AvailabilityBadge";
import { buildTearsheetPrintHtml } from "@/lib/tearsheetPrintHtml";

interface TearsheetProduct {
  id: string;
  product_name: string;
  brand_name: string;
  parent_brand: string;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  dimensions: string | null;
  materials: string | null;
  description: string | null;
  lead_time: string | null;
  trade_price_cents: number | null;
  currency: string;
  source: "curator" | "trade";
  source_pick_id?: string | null;
  size_variants?: { label?: string; base?: string; top?: string; price_cents?: number }[] | null;
}

const normalizeFinishText = (value: string | null | undefined) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const splitFinishTokens = (...values: Array<string | null | undefined>) =>
  values
    .flatMap((value) => String(value || "").split(/\s+[·•]\s+|\s+\/\s+|\s*,\s*/))
    .map(normalizeFinishText)
    .filter(Boolean);

const isCombinedFinishLabel = (value: string | null | undefined) =>
  /\s+[·•]\s+/.test(String(value || ""));

const meaningfulFinishWords = (value: string) =>
  normalizeFinishText(value)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !["cat", "fabric", "leather", "com", "finish", "upholstery"].includes(word));

const finishTokenMatchesField = (token: string, field: string) => {
  if (!token || !field) return false;
  if (field === token || field.includes(token) || token.includes(field)) return true;
  const tokenWords = meaningfulFinishWords(token);
  if (tokenWords.length === 0) return false;
  const fieldWords = new Set(meaningfulFinishWords(field));
  return tokenWords.some((word) => fieldWords.has(word));
};

function resolveSnapshotVariantPrice(
  variants: TearsheetProduct["size_variants"],
  finishes: { variant: string | null; wood: string | null; fabric: string | null },
): number | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const wanted = splitFinishTokens(finishes.variant, finishes.wood, finishes.fabric);
  if (wanted.length === 0) return null;

  let best: { cents: number; score: number } | null = null;
  for (const v of variants) {
    const cents = Number(v?.price_cents);
    if (!(cents > 0)) continue;
    const fields = [v?.label, v?.base, v?.top].map(normalizeFinishText).filter(Boolean);
    const score = wanted.reduce(
      (sum, token) => sum + (fields.some((field) => finishTokenMatchesField(token, field)) ? 1 : 0),
      0,
    );
    if (score > 0 && (!best || score > best.score)) best = { cents, score };
  }
  return best?.cents ?? null;
}

export default function TradeTearsheets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { session: conciergeSession, reset: resetConcierge } = useConciergeSession();
  const [search, setSearch] = useState("");
  const [filterDesigner, setFilterDesigner] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSubcategory, setFilterSubcategory] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const filterProjectId = searchParams.get("project");
  // Finish handoff. Priority: URL params (from Draft-Tearsheet CTA) →
  // concierge session (persists across surfaces even when the URL is bare).
  const initialFinishes = useMemo(() => {
    const sess = getConciergeSession();
    const p = (k: string) => searchParams.get(k);
    return {
      productId: p("product") ?? sess?.product?.id ?? null,
      fabric: p("fabric") ?? sess?.finishes.fabric ?? null,
      fabricImg: p("fabricImg") ?? sess?.finishes.fabricImg ?? null,
      wood: p("wood") ?? sess?.finishes.wood ?? null,
      woodImg: p("woodImg") ?? sess?.finishes.woodImg ?? null,
      variant: p("variant") ?? sess?.finishes.variant ?? null,
    };
  // Only read once on mount — subsequent URL edits don't reset the state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [chosenFinishes, setChosenFinishes] = useState<{
    fabric: string | null; fabricImg: string | null;
    wood: string | null; woodImg: string | null;
    variant: string | null;
  }>({
    fabric: initialFinishes.fabric,
    fabricImg: initialFinishes.fabricImg,
    wood: initialFinishes.wood,
    woodImg: initialFinishes.woodImg,
    variant: initialFinishes.variant,
  });
  const setFilterProjectId = (id: string | null) => {
    try {
      if (id) sessionStorage.setItem("trade:lastProjectFilter", id);
      else sessionStorage.removeItem("trade:lastProjectFilter");
    } catch {}
    const next = new URLSearchParams(searchParams);
    if (id) next.set("project", id); else next.delete("project");
    // Push so browser back/forward restores prior filter state.
    setSearchParams(next);
  };
  // On first mount: if no URL param, hydrate from sessionStorage (replace, no history entry).
  useEffect(() => {
    if (filterProjectId) {
      try { sessionStorage.setItem("trade:lastProjectFilter", filterProjectId); } catch {}
      return;
    }
    let stored: string | null = null;
    try { stored = sessionStorage.getItem("trade:lastProjectFilter"); } catch {}
    if (stored) {
      const next = new URLSearchParams(searchParams);
      next.set("project", stored);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Keep storage in sync with URL on subsequent navigations (back/forward included).
  useEffect(() => {
    try {
      if (filterProjectId) sessionStorage.setItem("trade:lastProjectFilter", filterProjectId);
    } catch {}
  }, [filterProjectId]);
  const [selectedProduct, setSelectedProduct] = useState<TearsheetProduct | null>(null);
  // Once the user explicitly returns to the list, stop the auto-select effect
  // from immediately re-opening the handoff product.
  const dismissedHandoffRef = useRef(false);
  const backToProducts = () => {
    dismissedHandoffRef.current = true;
    setSelectedProduct(null);
    const next = new URLSearchParams(searchParams);
    ["product", "fabric", "fabricImg", "wood", "woodImg", "variant"].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  const printRef = useRef<HTMLDivElement>(null);

  // Resolve a display-ready lead time for the selected product:
  //  1) trade_products.lead_time (freeform string) if present
  //  2) product override on trade_products
  //  3) brand_lead_times default (looked up by brand_name AND parent_brand)
  const { data: leadTimeInfo } = useQuery({
    queryKey: ["tearsheet-lead-time", selectedProduct?.id, selectedProduct?.brand_name, selectedProduct?.parent_brand],
    enabled: !!selectedProduct,
    queryFn: async () => {
      if (!selectedProduct) return null;
      if (selectedProduct.lead_time && selectedProduct.lead_time.trim()) {
        return { display: selectedProduct.lead_time.trim() };
      }
      let min: number | null = null;
      let max: number | null = null;
      if (selectedProduct.source === "trade") {
        const { data: tp } = await supabase
          .from("trade_products")
          .select("lead_weeks_min_override, lead_weeks_max_override")
          .eq("id", selectedProduct.id)
          .maybeSingle();
        min = (tp as any)?.lead_weeks_min_override ?? null;
        max = (tp as any)?.lead_weeks_max_override ?? null;
      }
      if (min == null && max == null) {
        const brands = Array.from(new Set([selectedProduct.brand_name, selectedProduct.parent_brand].filter(Boolean)));
        const { data: blt } = await supabase
          .from("brand_lead_times")
          .select("brand_name, default_lead_weeks_min, default_lead_weeks_max")
          .in("brand_name", brands);
        // Prefer the child brand over the parent when both exist.
        const byBrand = new Map<string, any>();
        (blt || []).forEach((b: any) => byBrand.set(b.brand_name, b));
        const b = byBrand.get(selectedProduct.brand_name) || byBrand.get(selectedProduct.parent_brand);
        min = b?.default_lead_weeks_min ?? null;
        max = b?.default_lead_weeks_max ?? null;
      }
      const lt = formatLeadTime(min, max);
      return { display: lt };
    },
  });
  const leadTimeDisplay = leadTimeInfo?.display || null;

  const dimensionsDisplay = useMemo(
    () => withImperialInline(selectedProduct?.dimensions) || null,
    [selectedProduct?.dimensions],
  );

  // Show selected finishes inline within the Materials cell so the tearsheet
  // reflects the picked wood/fabric even when the base `materials` column is
  // empty (curator picks often have no free-form materials text).
  const materialsDisplay = useMemo(() => {
    const base = (selectedProduct?.materials || "").trim();
    const finishParts = [
      chosenFinishes.wood && `Base / Wood: ${chosenFinishes.wood}`,
      chosenFinishes.fabric && `Fabric: ${chosenFinishes.fabric}`,
    ].filter(Boolean) as string[];
    if (finishParts.length) {
      return base ? `${base} · ${finishParts.join(" · ")}` : finishParts.join(" · ");
    }
    if (base) return base;
    // Final fallback: derive from size_variants axes so the tearsheet still
    // shows a meaningful Materials line when the pick has no free-form text
    // and no finish was selected (e.g. brief-locked picks with only the
    // variant matrix populated).
    const variants = (selectedProduct?.size_variants as any[]) || [];
    if (variants.length) {
      const bases = Array.from(new Set(variants.map((v) => String(v?.base || "").trim()).filter(Boolean)));
      const tops = Array.from(new Set(variants.map((v) => String(v?.top || "").trim()).filter(Boolean)));
      const parts: string[] = [];
      if (bases.length) parts.push(`Base: ${bases.slice(0, 4).join(" / ")}`);
      if (tops.length) parts.push(`Top: ${tops.slice(0, 4).join(" / ")}`);
      if (parts.length) return parts.join(" · ");
    }
    return null;
  }, [selectedProduct?.materials, selectedProduct?.size_variants, chosenFinishes.wood, chosenFinishes.fabric]);


  // Fetch the set of product IDs (from quotes + boards) belonging to the selected
  // project. We also expand the set with curator-pick "twins" of any
  // trade_products IDs — the merged catalog dedups (brand, title) pairs and
  // keeps the curator id, so without this expansion a board referencing the
  // trade id wouldn't match anything in the rendered list.
  const { data: projectProductIds } = useQuery({
    queryKey: ["tearsheet-project-product-ids", filterProjectId, user?.id],
    enabled: !!filterProjectId && !!user,
    queryFn: async () => {
      const ids = new Set<string>();
      const [quotesRes, boardsRes] = await Promise.all([
        supabase.from("trade_quotes").select("id").eq("project_id", filterProjectId!),
        supabase.from("client_boards").select("id").eq("project_id", filterProjectId!),
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

      // Expand: add curator-pick IDs that share (brand, title) with any
      // trade_products in `ids`, and vice versa. Either side may be the
      // canonical id kept by the merge dedup.
      if (ids.size > 0) {
        const idArr = Array.from(ids);
        const [tradeRows, curatorRows] = await Promise.all([
          supabase.from("trade_products").select("brand_name, product_name").in("id", idArr),
          supabase.from("designer_curator_picks").select("id, title, designers!inner(name, founder)").in("id", idArr),
        ]);
        // Build (brand|title) -> looking for matching twins.
        const wantedPairs = new Set<string>();
        (tradeRows.data || []).forEach((r: any) => {
          if (r.brand_name && r.product_name) {
            wantedPairs.add(`${r.brand_name.toLowerCase()}::${r.product_name.toLowerCase()}`);
          }
        });
        (curatorRows.data || []).forEach((r: any) => {
          const designer = (r as any).designers;
          const name = designer?.name;
          if (name && r.title) {
            wantedPairs.add(`${name.toLowerCase()}::${r.title.toLowerCase()}`);
          }
        });
        if (wantedPairs.size > 0) {
          // Pull all curator picks + trade products and add ids whose pair matches.
          const [allCurator, allTrade] = await Promise.all([
            supabase.from("designer_curator_picks").select("id, title, designers!inner(name)"),
            supabase.from("trade_products").select("id, product_name, brand_name"),
          ]);
          (allCurator.data || []).forEach((r: any) => {
            const name = (r as any).designers?.name;
            if (!name || !r.title) return;
            const k = `${name.toLowerCase()}::${r.title.toLowerCase()}`;
            if (wantedPairs.has(k)) ids.add(r.id);
          });
          (allTrade.data || []).forEach((r: any) => {
            if (!r.brand_name || !r.product_name) return;
            const k = `${r.brand_name.toLowerCase()}::${r.product_name.toLowerCase()}`;
            if (wantedPairs.has(k)) ids.add(r.id);
          });
        }
      }
      return ids;
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["tearsheet-products-merged"],
    queryFn: async () => {
      // Fetch curator picks, trade_products, and all designers for parent mapping
      const [curatorRes, tradeRes, designerRes] = await Promise.all([
        supabase
          .from("designer_curator_picks")
          .select("id, title, designer_id, category, subcategory, image_url, dimensions, materials, description, lead_time, trade_price_cents, currency, size_variants, designers!inner(name, founder)")
          .order("title"),
        supabase
          .from("trade_products")
          .select("id, product_name, brand_name, category, subcategory, image_url, dimensions, materials, description, lead_time, trade_price_cents, currency, size_variants, source_pick_id")
          .eq("is_active", true)
          // Note: we no longer require image_url at the query level — missing
          // hero images are backfilled from the linked curator pick below
          // (audit #7) so priced mirrors aren't silently hidden from the
          // tearsheet picker just because the mirror row lacks an image.
          .order("brand_name")
          .order("product_name"),
        supabase
          .from("designers")
          .select("name, founder")
          .not("founder", "is", null),
      ]);

      // Backfill missing trade_products.image_url from the linked curator pick.
      const tradeRows = (tradeRes.data || []) as any[];
      await fillTradeProductImageFallbacks(tradeRows);
      // Drop anything still without an image — tearsheets are visual.
      const tradeWithImages = tradeRows.filter((p) => !!p.image_url);

      // Build a lookup: child designer name → parent brand
      const childToParent = new Map<string, string>();
      (designerRes.data || []).forEach((d: any) => {
        if (d.founder && d.founder !== d.name) {
          childToParent.set(d.name.toLowerCase(), d.founder);
        }
      });

      const seen = new Map<string, boolean>();
      const merged: TearsheetProduct[] = [];

      // Add curator picks — display child designer name, group under parent brand
      (curatorRes.data || []).forEach((p: any) => {
        const designer = p.designers as any;
        const designerName = designer?.name || "Unknown";
        const founder = designer?.founder;
        const isChild = founder && founder !== designerName;
        // Display name keeps the child designer, parent_brand is used for filtering/grouping
        const displayName = designerName;
        const parentBrand = isChild ? founder : designerName;
        // Dedup key uses parent brand to avoid duplicates across parent/child
        const key = `${parentBrand.toLowerCase()}::${p.title.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.set(key, true);
        // Derive a display dimension from size_variants[].label when the
        // dedicated `dimensions` column is empty (many curator picks store
        // dimensions only inside the variant matrix).
        const variantList = (p.size_variants as any[]) || [];
        const firstVariantDim = variantList
          .map((v: any) => String(v?.label || "").trim())
          .find((s: string) => /\d/.test(s) && /(cm|mm|in|["″])/i.test(s)) || null;
        merged.push({
          id: p.id,
          product_name: p.title,
          brand_name: displayName,
          parent_brand: parentBrand,
          category: normalizeCategory(p.category, p.subcategory) || null,
          subcategory: normalizeSubcategory(p.subcategory) || null,
          image_url: p.image_url,
          dimensions: p.dimensions || firstVariantDim,
          materials: p.materials,
          description: p.description,
          lead_time: p.lead_time || null,
          trade_price_cents: p.trade_price_cents || null,
          currency: p.currency || "EUR",
          source: "curator",
          source_pick_id: p.id,
          size_variants: variantList,
        });
      });

      // Add trade products that aren't already covered
      tradeWithImages.forEach((p: any) => {
        // Resolve parent brand from child→parent map
        const resolvedParent = childToParent.get(p.brand_name.toLowerCase()) || p.brand_name;
        const key = `${resolvedParent.toLowerCase()}::${p.product_name.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.set(key, true);
        const tVariantList = (p.size_variants as any[]) || [];
        const tFirstVariantDim = tVariantList
          .map((v: any) => String(v?.label || "").trim())
          .find((s: string) => /\d/.test(s) && /(cm|mm|in|["″])/i.test(s)) || null;
        merged.push({
          id: p.id,
          product_name: p.product_name,
          brand_name: p.brand_name,
          parent_brand: resolvedParent,
          category: normalizeCategory(p.category, p.subcategory) || null,
          subcategory: normalizeSubcategory(p.subcategory) || null,
          image_url: p.image_url,
          dimensions: p.dimensions || tFirstVariantDim,
          materials: p.materials,
          description: p.description,
          lead_time: p.lead_time,
          trade_price_cents: p.trade_price_cents || null,
          currency: p.currency || "EUR",
          source: "trade",
          source_pick_id: p.source_pick_id ?? null,
          size_variants: tVariantList,
        });
      });

      // Sort by brand then product name
      merged.sort((a, b) => a.brand_name.localeCompare(b.brand_name) || a.product_name.localeCompare(b.product_name));
      return merged;
    },
  });

  // Derive unique values for filter dropdowns using taxonomy order
  const designers = useMemo(() => [...new Set(products.map((p) => p.parent_brand))].sort(), [products]);
  const categories = useMemo(() => {
    const raw = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
    return CATEGORY_ORDER.filter((c) => raw.includes(c));
  }, [products]);
  const subcategories = useMemo(() => {
    if (!filterCategory) return [];
    const taxonomySubs = getSubcategoriesForCategory(filterCategory);
    const dataSubs = [...new Set(
      products.filter((p) => p.category === filterCategory).map((p) => p.subcategory).filter(Boolean)
    )] as string[];
    // Return taxonomy-ordered subs that exist in data
    const ordered = taxonomySubs.filter((s) => dataSubs.includes(s));
    // Add any data subs not in taxonomy
    dataSubs.forEach((s) => { if (!ordered.includes(s)) ordered.push(s); });
    return ordered;
  }, [products, filterCategory]);

  // Auto-select the incoming product once the merged catalog is loaded.
  // We match by exact id first, then by curator/trade twin (same id present
  // on either side of the merge), so links from the product page land on the
  // right tearsheet even when the merge kept the "other" canonical id.
  useEffect(() => {
    if (dismissedHandoffRef.current) return;
    if (!initialFinishes.productId || selectedProduct || products.length === 0) return;
    const direct = products.find((p) => p.id === initialFinishes.productId);
    if (direct) { setSelectedProduct(direct); return; }
    // Twin fallback: look up the incoming id's (brand, title) pair from both
    // source tables and match against the merged list.
    (async () => {
      const [tp, cp] = await Promise.all([
        supabase.from("trade_products").select("brand_name, product_name").eq("id", initialFinishes.productId!).maybeSingle(),
        supabase.from("designer_curator_picks").select("title, designers!inner(name)").eq("id", initialFinishes.productId!).maybeSingle(),
      ]);
      const brand = (tp.data as any)?.brand_name || ((cp.data as any)?.designers?.name);
      const name = (tp.data as any)?.product_name || (cp.data as any)?.title;
      if (!brand || !name) return;
      const match = products.find(
        (p) => p.product_name.toLowerCase() === String(name).toLowerCase() &&
               (p.brand_name.toLowerCase() === String(brand).toLowerCase() || p.parent_brand.toLowerCase() === String(brand).toLowerCase())
      );
      if (match) setSelectedProduct(match);
    })();
  }, [products, initialFinishes.productId, selectedProduct]);

  useEffect(() => {
    if (!selectedProduct || !chosenFinishes.fabricImg || !isCombinedFinishLabel(chosenFinishes.fabric)) return;
    const pickId = selectedProduct.source_pick_id || selectedProduct.id;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("product_fabric_swatches_public")
        .select("name, image_url, category")
        .eq("pick_id", pickId)
        .eq("is_active", true);
      if (cancelled) return;
      const match = (data || []).find((s: any) => s.image_url === chosenFinishes.fabricImg);
      const category = String((match as any)?.category || "").trim().toLowerCase();
      if (match?.name && ["fabric & leather", "fabric", "leather", "upholstery"].includes(category)) {
        setChosenFinishes((prev) => ({ ...prev, fabric: match.name }));
      }
    })();
    return () => { cancelled = true; };
  }, [selectedProduct, chosenFinishes.fabric, chosenFinishes.fabricImg]);

  // Split a combined finish label ("Natural Walnut · Pall Stone") that
  // landed in a single field (usually `wood` from a legacy URL/board note)
  // into wood + fabric so both swatches render on the tearsheet.
  useEffect(() => {
    if (!selectedProduct) return;
    if (chosenFinishes.fabric) return;
    if (!isCombinedFinishLabel(chosenFinishes.wood)) return;
    const [left, right] = String(chosenFinishes.wood).split(/\s+[·•]\s+/).map((s) => s.trim());
    if (!left || !right) return;
    setChosenFinishes((prev) => ({
      ...prev,
      wood: left,
      fabric: prev.fabric ?? right,
    }));
  }, [selectedProduct, chosenFinishes.wood, chosenFinishes.fabric]);

  // Backfill missing swatch images by looking up the pick's active swatches
  // by name (case-insensitive). Runs when a finish label is known but the
  // corresponding `Img` URL is null — e.g. links from a client board that
  // stored only labels, or brief-locked picks where only names were carried.
  useEffect(() => {
    if (!selectedProduct) return;
    const needWood = !!chosenFinishes.wood && !chosenFinishes.woodImg;
    const needFabric = !!chosenFinishes.fabric && !chosenFinishes.fabricImg;
    if (!needWood && !needFabric) return;
    const pickId = selectedProduct.source_pick_id || selectedProduct.id;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("product_fabric_swatches_public")
        .select("name, image_url, category")
        .eq("pick_id", pickId)
        .eq("is_active", true);
      if (cancelled || !data?.length) return;
      const norm = (s: string) => normalizeFinishText(s);
      const findByName = (label: string | null) => {
        if (!label) return null;
        const target = norm(label);
        if (!target) return null;
        const exact = (data as any[]).find((s) => norm(s.name) === target);
        if (exact) return exact;
        return (data as any[]).find((s) => {
          const n = norm(s.name);
          return n && (n.includes(target) || target.includes(n));
        }) || null;
      };
      const woodMatch = needWood ? findByName(chosenFinishes.wood) : null;
      const fabricMatch = needFabric ? findByName(chosenFinishes.fabric) : null;
      if (!woodMatch && !fabricMatch) return;
      setChosenFinishes((prev) => ({
        ...prev,
        woodImg: prev.woodImg ?? (woodMatch?.image_url || null),
        fabricImg: prev.fabricImg ?? (fabricMatch?.image_url || null),
      }));
    })();
    return () => { cancelled = true; };
  }, [selectedProduct, chosenFinishes.wood, chosenFinishes.fabric, chosenFinishes.woodImg, chosenFinishes.fabricImg]);




  const filtered = products.filter((p) => {
    if (search && ![p.product_name, p.brand_name].some((f) => f?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterDesigner && p.parent_brand !== filterDesigner) return false;
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterSubcategory && p.subcategory !== filterSubcategory) return false;
    if (filterProjectId && projectProductIds && !projectProductIds.has(p.id)) return false;
    return true;
  });

  // ─── Push to Client Board ────────────────────────────────────────────────
  const { toast } = useToast();
  const { currentStudio, canEdit } = useStudio();
  const [boardPickerOpen, setBoardPickerOpen] = useState(false);
  const [pushingBoardId, setPushingBoardId] = useState<string | null>(null);
  const [pushedBoardIds, setPushedBoardIds] = useState<Set<string>>(new Set());
  const [showCreateBoardForm, setShowCreateBoardForm] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardClientName, setNewBoardClientName] = useState("");
  const [newBoardClientEmail, setNewBoardClientEmail] = useState("");
  const [creatingBoard, setCreatingBoard] = useState(false);
  const { boards: userBoards, loading: boardsLoading } = useUserBoards(boardPickerOpen);

  const pushToBoard = async (boardId: string): Promise<boolean> => {
    if (!selectedProduct) return false;
    setPushingBoardId(boardId);
    try {
      // client_board_items.product_id FKs to trade_products.id. Resolve if the
      // selected row is a curator pick (source_pick_id → trade_products.id).
      let tradeProductId: string | null = null;
      if (selectedProduct.source === "trade") {
        tradeProductId = selectedProduct.id;
      } else {
        const { data: tp } = await supabase
          .from("trade_products")
          .select("id")
          .eq("source_pick_id", selectedProduct.id)
          .maybeSingle();
        tradeProductId = (tp as any)?.id ?? null;
      }
      if (!tradeProductId) {
        toast({
          title: "Not on the trade catalog yet",
          description: "This product hasn't been mirrored into trade_products, so it can't be pinned to a board.",
          variant: "destructive",
        });
        return false;
      }

      const noteLines: string[] = [];
      if (chosenFinishes.variant) noteLines.push(`Variant: ${chosenFinishes.variant}`);
      if (chosenFinishes.wood) noteLines.push(`Base / Wood: ${chosenFinishes.wood}`);
      if (chosenFinishes.fabric) noteLines.push(`Fabric: ${chosenFinishes.fabric}`);
      const notes = noteLines.length ? noteLines.join("\n") : null;

      // Next sort_order = current item count on the board.
      const { count } = await supabase
        .from("client_board_items")
        .select("id", { count: "exact", head: true })
        .eq("board_id", boardId);

      const insertPayload: any = {
        board_id: boardId,
        product_id: tradeProductId,
        sort_order: count ?? 0,
        notes,
        variant_label: chosenFinishes.variant || null,
        fabric_label: chosenFinishes.fabric || null,
        wood_label: chosenFinishes.wood || null,
      };

      const { error } = await supabase
        .from("client_board_items")
        .insert(insertPayload);

      if (error) {
        toast({ title: "Couldn't add to board", description: error.message, variant: "destructive" });
        return false;
      }
      setPushedBoardIds((prev) => new Set(prev).add(boardId));
      toast({ title: "Added to board", description: `${selectedProduct.product_name} pinned with the chosen finishes.` });
      return true;
    } finally {
      setPushingBoardId(null);
    }
  };

  const createBoardAndPush = async () => {
    if (!user || !newBoardTitle.trim() || !selectedProduct) return;
    if (currentStudio && !canEdit) {
      toast({ title: "Read-only role", description: "Your role in this studio doesn't allow creating boards.", variant: "destructive" });
      return;
    }
    setCreatingBoard(true);
    try {
      const { data, error } = await supabase
        .from("client_boards")
        .insert({
          user_id: user.id,
          studio_id: currentStudio?.id ?? null,
          title: newBoardTitle.trim(),
          client_name: newBoardClientName.trim() || null,
          client_email: newBoardClientEmail.trim() || null,
        } as any)
        .select()
        .single();
      if (error || !data) {
        toast({ title: "Couldn't create board", description: error?.message || "Unknown error", variant: "destructive" });
        return;
      }
      const success = await pushToBoard(data.id);
      if (success) {
        setNewBoardTitle("");
        setNewBoardClientName("");
        setNewBoardClientEmail("");
        setShowCreateBoardForm(false);
        setBoardPickerOpen(false);
      }
    } finally {
      setCreatingBoard(false);
    }
  };



  const handlePrint = () => {
    if (!printRef.current || !selectedProduct) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildTearsheetPrintHtml({
        selectedProduct: { ...selectedProduct, trade_price_cents: snapshotPriceCents },
        chosenFinishes,
        dimensionsDisplay,
        materialsDisplay,
        leadTimeDisplay,
      }),
    );
    win.document.close();
    win.print();
  };

  const snapshotPriceCents = useMemo(
    () => resolveSnapshotVariantPrice(selectedProduct?.size_variants, chosenFinishes) ?? selectedProduct?.trade_price_cents ?? null,
    [selectedProduct?.size_variants, selectedProduct?.trade_price_cents, chosenFinishes],
  );

  return (
    <>
      <Helmet><title>Tearsheet Builder — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <TradeBreadcrumb current="Tearsheets" currentProjectTab="tearsheets" />
        <div>
          <h1 className="font-display text-2xl text-foreground">Tearsheet Builder</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Generate one-click product tearsheets with specs, dimensions, and pricing for client handoff.
          </p>
        </div>

        {conciergeSession && (conciergeSession.product || conciergeSession.briefText || conciergeSession.finishes.fabric || conciergeSession.finishes.wood) && (
          <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-body text-[10px] uppercase tracking-[0.14em] text-accent mb-1">
                Concierge session active
              </div>
              <div className="font-body text-xs text-foreground truncate">
                {conciergeSession.product?.title ? (
                  <>
                    <span className="font-medium">{conciergeSession.product.title}</span>
                    {conciergeSession.product.designer_name && (
                      <span className="text-muted-foreground"> · {conciergeSession.product.designer_name}</span>
                    )}
                    {conciergeSession.locked && <span className="text-accent"> · Finishes locked</span>}
                  </>
                ) : (
                  <span className="text-muted-foreground">Brief captured — pick a product to continue</span>
                )}
              </div>
              {(conciergeSession.finishes.fabric || conciergeSession.finishes.wood || conciergeSession.finishes.variant) && (
                <div className="font-body text-[11px] text-muted-foreground mt-0.5 truncate">
                  {[
                    conciergeSession.finishes.fabric && `Fabric: ${conciergeSession.finishes.fabric}`,
                    conciergeSession.finishes.wood && `Wood: ${conciergeSession.finishes.wood}`,
                    conciergeSession.finishes.variant && `Variant: ${conciergeSession.finishes.variant}`,
                  ].filter(Boolean).join(" · ")}
                </div>
              )}
              {conciergeSession.briefText && (
                <div className="font-body text-[11px] text-muted-foreground mt-0.5">
                  Brief attached ({conciergeSession.briefText.length.toLocaleString()} chars) — carried into quote.
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {conciergeSession.product && (
                <Button
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("fromSession", "1");
                    navigate(`/trade/quotes?${params.toString()}`);
                  }}
                >
                  Continue to Quote →
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => resetConcierge()}>Clear</Button>
            </div>
          </div>
        )}

        {selectedProduct ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              {(() => {
                const fromBoard = searchParams.get("fromBoard");
                if (fromBoard) {
                  return (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/trade/boards/${fromBoard}`)}>← Back to board</Button>
                  );
                }
                return (
                  <Button variant="ghost" size="sm" onClick={backToProducts}>← Back to products</Button>
                );
              })()}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setPushedBoardIds(new Set()); setBoardPickerOpen(true); }}>
                  <LayoutGrid className="h-4 w-4 mr-2" />Push to Client Board
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print Tearsheet</Button>
              </div>
            </div>

            <div ref={printRef} className="border border-border rounded-lg p-6 space-y-6">
              <div className="border-b border-border pb-4">
                <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{selectedProduct.brand_name}</p>
                <h2 className="font-display text-xl text-foreground mt-1">{selectedProduct.product_name}</h2>
                {chosenFinishes.variant && (
                  <p className="font-body text-[11px] text-muted-foreground mt-1">Variant · {chosenFinishes.variant}</p>
                )}
              </div>
              {selectedProduct.image_url && (
                <img src={selectedProduct.image_url} alt={selectedProduct.product_name} className="max-h-72 object-contain border border-border rounded" />
              )}
              {(chosenFinishes.fabric || chosenFinishes.wood) && (
                <div className="border border-border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Selected Finishes</p>
                    <button
                      type="button"
                      onClick={() => setChosenFinishes({ fabric: null, fabricImg: null, wood: null, woodImg: null, variant: null })}
                      className="font-body text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    {chosenFinishes.wood && (
                      <div className="flex items-center gap-3">
                        {chosenFinishes.woodImg && (
                          <img src={chosenFinishes.woodImg} alt={chosenFinishes.wood} className="w-14 h-14 object-cover rounded border border-border" />
                        )}
                        <div>
                          <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Base / Wood</p>
                          <p className="font-body text-sm text-foreground">{chosenFinishes.wood}</p>
                        </div>
                      </div>
                    )}
                    {chosenFinishes.fabric && (
                      <div className="flex items-center gap-3">
                        {chosenFinishes.fabricImg && (
                          <img src={chosenFinishes.fabricImg} alt={chosenFinishes.fabric} className="w-14 h-14 object-cover rounded border border-border" />
                        )}
                        <div>
                          <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Fabric</p>
                          <p className="font-body text-sm text-foreground">{chosenFinishes.fabric}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {([
                  ["Category", selectedProduct.category],
                  ["Dimensions", dimensionsDisplay],
                  ["Materials", materialsDisplay],
                  ["Lead Time", leadTimeDisplay],
                  ["Trade Price", snapshotPriceCents
                    ? `${selectedProduct.currency === "USD" ? "$" : selectedProduct.currency === "GBP" ? "£" : selectedProduct.currency === "SGD" ? "S$" : "€"}${(snapshotPriceCents / 100).toLocaleString()}`
                    : "Price Upon Request"],
                ] as const).map(([label, val]) => (
                  <div key={label}>
                    <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="font-body text-sm text-foreground mt-0.5 whitespace-pre-line">{val || "—"}</p>
                  </div>
                ))}
              </div>

              {selectedProduct.description && (
                <div>
                  <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Description</p>
                  <p className="font-body text-sm text-muted-foreground mt-1">{selectedProduct.description}</p>
                </div>
              )}
              <div className="border-t border-border pt-4">
                <p className="font-body text-[10px] text-muted-foreground">Generated by Maison Affluency Trade Portal · {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10 font-body text-sm" />
              </div>
              <select
                value={filterDesigner}
                onChange={(e) => setFilterDesigner(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 font-body text-sm text-foreground"
              >
                <option value="">All Designers</option>
                {designers.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setFilterSubcategory(""); }}
                className="h-9 rounded-md border border-input bg-background px-3 font-body text-sm text-foreground"
              >
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {subcategories.length > 0 && (
                <select
                  value={filterSubcategory}
                  onChange={(e) => setFilterSubcategory(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 font-body text-sm text-foreground"
                >
                  <option value="">All Subcategories</option>
                  {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <ProjectPicker value={filterProjectId} onChange={setFilterProjectId} compact />
              {(filterDesigner || filterCategory || filterSubcategory || filterProjectId) && (
                <button
                  onClick={() => { setFilterDesigner(""); setFilterCategory(""); setFilterSubcategory(""); setFilterProjectId(null); }}
                  className="font-body text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
            {filterProjectId && (
              <p className="font-body text-[11px] text-muted-foreground -mt-1">
                Showing only products from this project's quotes and boards.
              </p>
            )}
            {isLoading ? (
              <div className="flex justify-center py-20"><DotCircleLoader size="sm" className="text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border rounded-lg">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-body text-sm text-muted-foreground">No products found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className="group flex items-start gap-3 p-4 rounded-lg border border-border hover:border-foreground/30 bg-card text-left transition-all hover:shadow-sm"
                  >
                    <div className="w-16 h-16 rounded bg-muted overflow-hidden shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><FileText className="h-5 w-5 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm text-foreground truncate">{p.product_name}</p>
                      <p className="font-body text-[11px] text-muted-foreground">{p.brand_name}</p>
                      <p className="font-body text-[10px] text-muted-foreground/70 mt-1 capitalize">{p.category || "—"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={boardPickerOpen} onOpenChange={(open) => {
        setBoardPickerOpen(open);
        if (!open) {
          setShowCreateBoardForm(false);
          setNewBoardTitle("");
          setNewBoardClientName("");
          setNewBoardClientEmail("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Push to Client Board</DialogTitle>
            <DialogDescription className="font-body text-xs">
              Pin {selectedProduct?.product_name ?? "this product"} to one of your boards, or create a new board on the fly.
              {(chosenFinishes.fabric || chosenFinishes.wood || chosenFinishes.variant) && (
                <span className="block mt-1 text-muted-foreground">
                  Finishes will be saved as a note on the board item:
                  {chosenFinishes.variant ? ` ${chosenFinishes.variant}` : ""}
                  {chosenFinishes.wood ? ` · ${chosenFinishes.wood}` : ""}
                  {chosenFinishes.fabric ? ` · ${chosenFinishes.fabric}` : ""}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[28rem] overflow-y-auto space-y-3 pr-1">
            {!showCreateBoardForm ? (
              <button
                type="button"
                onClick={() => setShowCreateBoardForm(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-dashed border-border hover:border-foreground/30 bg-background text-left transition-all text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                <span className="font-body text-xs uppercase tracking-widest">Create new client board</span>
              </button>
            ) : (
              <div className="rounded-md border border-border bg-card p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="font-body text-xs uppercase tracking-wider">Board Title</Label>
                  <Input
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                    placeholder="e.g. Smith Residence"
                    className="font-body text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs uppercase tracking-wider">Client Name (optional)</Label>
                  <Input
                    value={newBoardClientName}
                    onChange={(e) => setNewBoardClientName(e.target.value)}
                    placeholder="Client name"
                    className="font-body text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-xs uppercase tracking-wider">Client Email (optional)</Label>
                  <Input
                    value={newBoardClientEmail}
                    onChange={(e) => setNewBoardClientEmail(e.target.value)}
                    placeholder="client@email.com"
                    className="font-body text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={createBoardAndPush}
                    disabled={creatingBoard || !newBoardTitle.trim()}
                    className="flex-1 font-body text-xs uppercase tracking-widest"
                  >
                    {creatingBoard && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create & Push
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateBoardForm(false);
                      setNewBoardTitle("");
                      setNewBoardClientName("");
                      setNewBoardClientEmail("");
                    }}
                    disabled={creatingBoard}
                    className="font-body text-xs uppercase tracking-widest"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {boardsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : userBoards.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground py-6 text-center">
                No existing boards. Create one above to push this tear sheet.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Existing boards</p>
                {userBoards.map((b) => {
                  const pushed = pushedBoardIds.has(b.id);
                  const busy = pushingBoardId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={busy || pushed}
                      onClick={() => pushToBoard(b.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-border hover:border-foreground/30 bg-card text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="min-w-0">
                        <p className="font-display text-sm text-foreground truncate">{b.title}</p>
                        <p className="font-body text-[11px] text-muted-foreground truncate">
                          {b.client_name || "—"} · {b.item_count} item{b.item_count === 1 ? "" : "s"} · {b.status}
                        </p>
                      </div>
                      {pushed ? (
                        <span className="flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-emerald-600">
                          <Check className="h-3 w-3" /> Added
                        </span>
                      ) : busy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Add →</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>

  );
}
