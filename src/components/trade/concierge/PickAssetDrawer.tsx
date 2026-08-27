import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Product3DViewer from "@/components/trade/Product3DViewer";
import { FileText, FolderPlus, Loader2, RotateCcw, Check, Pencil, ExternalLink } from "lucide-react";
import { updateConciergeSession, useConciergeSession } from "@/hooks/useConciergeSession";
import { computeVariantAxes } from "@/lib/parseSizeVariants";
import { makeSwatchAxisFilter } from "@/lib/finishDuplication";
import { formatVariantAxisLabel } from "@/lib/variantPlaceholders";
import { resolveActiveVariant, resolvePartialDualMinCents } from "@/lib/resolveActiveVariant";
import AddToProjectPopover from "@/components/trade/AddToProjectPopover";

interface Swatch {
  fabric_id: string;
  name: string;
  image_url: string | null;
  supplier: string | null;
  category: string | null;
  price_tier_label?: string | null;
  sort_order: number | null;
}

interface Props {
  pickId: string;
  title: string;
}

type FinishRole = "fabric" | "base" | "top";

const isFabricAxisLabel = (label: string | null | undefined) =>
  /\b(upholstery|fabric|leather|textile|cover)\b/i.test(String(label || ""));

const isFabricVariantOption = (label: string | null | undefined) =>
  /\b(com fabric|fabric cat\.?|leather cat\.?|upholstery)\b/i.test(String(label || ""));

/** Classify a swatch into fabric / base (wood · metal) / top (stone · marble ·
 *  glass · ceramic). Category is authoritative; the name regex is only a
 *  fallback when the category is missing. Mirrors the axis split enforced by
 *  the GLB Material Roles editor so the drawer's swatch groups match what the
 *  3D viewer is actually retexturing.
 */
function classifySwatch(s: Swatch): FinishRole {
  const cat = (s.category ?? "").trim().toLowerCase();
  const name = (s.name ?? "").toLowerCase();
  if (
    cat === "fabric & leather" ||
    cat === "fabric" ||
    cat === "leather" ||
    cat === "upholstery" ||
    cat === "rug finish" ||
    cat === "rug finishes" ||
    cat === "rug"
  ) {
    return "fabric";
  }
  if (cat === "stone" || cat === "marble" || cat === "glass" || cat === "ceramic") {
    return "top";
  }
  if (cat === "wood" || cat === "metal") {
    return "base";
  }
  if (!cat) {
    if (/(marble|stone|onyx|onice|travertino|travertine|granite|quartz|glass|ceramic|porcelain)/.test(name)) {
      return "top";
    }
    if (/(wood|oak|walnut|ash|teak|maple|mahogany|metal|brass|bronze|steel|iron|lacquer|paint|frame|base)/.test(name)) {
      return "base";
    }
  }
  return "base";
}

/**
 * Inline drawer that fetches a pick's GLB URL (via trade_products.source_pick_id)
 * and its fabric swatch strip (product_fabric_swatches_public). Rendered lazily
 * from TearsheetProposalCard / QuoteProposalCard when the architect opens the
 * per-row "3D & finishes" section.
 */
export function PickAssetDrawer({ pickId, title }: Props) {
  // Per-row finish persistence. Keyed by pickId so collapsing/re-locking a
  // row restores the exact fabric/base/top the architect had chosen. Scoped
  // to the tab via sessionStorage — never leaves the concierge session.
  const storageKey = `concierge:pick-finishes:${pickId}`;
  const readPersisted = () => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };
  const persisted = readPersisted();

  const [loading, setLoading] = useState(true);
  const [poster, setPoster] = useState<string | null>(null);
  const [glbVariants, setGlbVariants] = useState<
    { label: string; glb_url: string; material_roles: Record<string, "fabric" | "base" | "top" | "ignore"> | null; is_default: boolean }[]
  >([]);
  const [selectedGlbLabel, setSelectedGlbLabel] = useState<string | null>(
    persisted?.glbLabel ?? null,
  );
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(
    persisted?.fabricId ?? null,
  );
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(
    persisted?.baseId ?? null,
  );
  const [selectedTopId, setSelectedTopId] = useState<string | null>(
    persisted?.topId ?? null,
  );
  const [pickAxes, setPickAxes] = useState<{
    baseOptions: string[];
    topOptions: string[];
    baseAxisLabel: string | null;
    topAxisLabel: string | null;
    pairs: { base: string; top: string }[];
  }>({ baseOptions: [], topOptions: [], baseAxisLabel: null, topAxisLabel: null, pairs: [] });
  const [tradeMeta, setTradeMeta] = useState<{
    tradeProductId: string | null;
    tradePriceCents: number | null;
    rrpPriceCents: number | null;
    currency: string | null;
    leadTime: string | null;
  }>({ tradeProductId: null, tradePriceCents: null, rrpPriceCents: null, currency: null, leadTime: null });
  const [sizeVariants, setSizeVariants] = useState<
    { label?: string; base?: string; top?: string; price_cents?: number }[]
  >([]);

  // Project / client-folder name for this concierge chat. Persisted on the
  // shared concierge session so subsequent items in the same chat auto-reuse
  // it (see "Would you like me to add this to Apt 4B as well?" flow).
  const { session } = useConciergeSession();
  const projectName = session?.projectName ?? null;
  const [projectDraft, setProjectDraft] = useState<string>("");
  const [editingProject, setEditingProject] = useState(false);

  // Mirror selections to sessionStorage on every change so a collapse/expand
  // (or an "unlock → re-lock") cycle restores the previous picks verbatim.
  useEffect(() => {
    try {
      const payload = {
        fabricId: selectedFabricId,
        baseId: selectedBaseId,
        topId: selectedTopId,
        glbLabel: selectedGlbLabel,
      };
      if (!selectedFabricId && !selectedBaseId && !selectedTopId && !selectedGlbLabel) {
        sessionStorage.removeItem(storageKey);
      } else {
        sessionStorage.setItem(storageKey, JSON.stringify(payload));
      }
    } catch {
      /* quota / disabled — ignore */
    }
  }, [storageKey, selectedFabricId, selectedBaseId, selectedTopId, selectedGlbLabel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // `pickId` can actually be either a designer_curator_picks.id (common)
      // OR a trade_products.id — the concierge preview falls back to the
      // trade catalog for pieces not present in designer_curator_picks (see
      // trade-concierge/index.ts:3540). Resolve to the canonical trade
      // product row + underlying pick id so GLB/swatch queries always hit.
      let prodRes = await supabase
        .from("trade_products")
        .select("id, source_pick_id, glb_url, image_url, trade_price_cents, rrp_price_cents, currency, lead_time")
        .eq("source_pick_id", pickId)
        .maybeSingle();
      if (!prodRes.data && !prodRes.error) {
        prodRes = await supabase
          .from("trade_products")
          .select("id, source_pick_id, glb_url, image_url, trade_price_cents, rrp_price_cents, currency, lead_time")
          .eq("id", pickId)
          .maybeSingle();
      }
      const tpId = (prodRes.data as any)?.id as string | undefined;
      const resolvedPickId =
        ((prodRes.data as any)?.source_pick_id as string | undefined) || pickId;

      const [pickRes, swRes, glbVarRes] = await Promise.all([
        supabase
          .from("designer_curator_picks")
          .select("size_variants, base_axis_label, top_axis_label, trade_price_cents, currency, lead_time")
          .eq("id", resolvedPickId)
          .maybeSingle(),
        supabase
          .from("product_fabric_swatches_public")
          .select("fabric_id, name, image_url, supplier, category, price_tier_label, sort_order")
          .eq("pick_id", resolvedPickId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true }),
        tpId
          ? supabase
              .from("trade_product_glb_variants")
              .select("variant_label, glb_url, is_default, material_roles")
              .eq("product_id", tpId)
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (cancelled) return;
      if (prodRes.error) setError(prodRes.error.message);

      const rawVariants = ((glbVarRes as any)?.data as any[]) || [];
      const legacyGlb = (prodRes.data as any)?.glb_url ?? null;
      const normalized = rawVariants
        .filter((v) => !!v?.glb_url)
        .map((v) => ({
          label: (v.variant_label as string) || "Default",
          glb_url: v.glb_url as string,
          material_roles: (v.material_roles as any) || null,
          is_default: !!v.is_default,
        }));
      // Fall back to the legacy single glb_url when no variants rows exist.
      if (normalized.length === 0 && legacyGlb) {
        normalized.push({ label: "Default", glb_url: legacyGlb, material_roles: null, is_default: true });
      }
      setGlbVariants(normalized);
      setPoster((prodRes.data as any)?.image_url ?? null);
      setSwatches(((swRes.data as any[]) ?? []) as Swatch[]);

      const pickRow = (pickRes.data as any) || null;
      const sv = (pickRow?.size_variants as any[]) || [];
      const axes = computeVariantAxes(sv);
      // Extract unique coupled (base, top) pairs from size_variants. These
      // are the only valid combinations when the design-editor product sheet
      // has locked base × top together (e.g. Praia da Granja: Walnut ↔ Pall
      // Stone, Black Pepper Oak ↔ Nero Marquina). Base and Top can never be
      // chosen independently for such picks.
      const pairSet = new Map<string, { base: string; top: string }>();
      for (const v of sv) {
        const b = (v?.base ?? "").trim();
        const t = (v?.top ?? "").trim();
        if (b && t) {
          const key = `${b.toLowerCase()}||${t.toLowerCase()}`;
          if (!pairSet.has(key)) pairSet.set(key, { base: b, top: t });
        }
      }
      setPickAxes({
        baseOptions: axes.baseOptions || [],
        topOptions: axes.topOptions || [],
        baseAxisLabel: pickRow?.base_axis_label ?? null,
        topAxisLabel: pickRow?.top_axis_label ?? null,
        pairs: Array.from(pairSet.values()),
      });
      setSizeVariants(Array.isArray(sv) ? sv : []);

      const prodRow = (prodRes.data as any) || null;
      setTradeMeta({
        tradeProductId: prodRow?.id ?? null,
        tradePriceCents: prodRow?.trade_price_cents ?? null,
        rrpPriceCents: prodRow?.rrp_price_cents ?? pickRow?.trade_price_cents ?? null,
        currency: prodRow?.currency ?? null,
        leadTime: prodRow?.lead_time ?? pickRow?.lead_time ?? null,
      });

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickId]);

  const topAxisIsFabric = useMemo(
    () =>
      isFabricAxisLabel(pickAxes.topAxisLabel) ||
      (pickAxes.topOptions.length > 0 && pickAxes.topOptions.every(isFabricVariantOption)),
    [pickAxes.topAxisLabel, pickAxes.topOptions],
  );

  useEffect(() => {
    // Legacy sessions may have stored an upholstery category as `topId` from
    // the previous coupled-pair UI. Once a fabric/upholstery axis is detected,
    // drop that duplicate so fabric labels do not become "Zero · Safire".
    if (topAxisIsFabric && selectedTopId) setSelectedTopId(null);
  }, [topAxisIsFabric, selectedTopId]);

  const { fabricSwatches, baseSwatches, topSwatches, splitByClassifier } = useMemo(() => {
    const fab: Swatch[] = [];
    const nonFab: Swatch[] = [];
    for (const s of swatches) {
      if (classifySwatch(s) === "fabric") fab.push(s);
      else nonFab.push(s);
    }

    // Prefer the product's own axes (design-editor product sheet) to split
    // base vs top swatches — matches the axis convention rendered on the
    // public/trade product pages. Fall back to category-based classification
    // when the pick has no axes (single-axis or legacy rows).
    const baseFilter =
      pickAxes.baseOptions.length > 0 ? makeSwatchAxisFilter(pickAxes.baseOptions) : null;
    const topFilter =
      !topAxisIsFabric && pickAxes.topOptions.length > 0 ? makeSwatchAxisFilter(pickAxes.topOptions) : null;

    let base: Swatch[] = [];
    let top: Swatch[] = [];

    if (baseFilter || topFilter) {
      const topMatched = topFilter ? nonFab.filter((s) => topFilter(s.name)) : [];
      const topIds = new Set(topMatched.map((s) => s.fabric_id));
      const remaining = nonFab.filter((s) => !topIds.has(s.fabric_id));
      const baseMatched = baseFilter ? remaining.filter((s) => baseFilter(s.name)) : [];
      const baseIds = new Set(baseMatched.map((s) => s.fabric_id));
      const orphans = remaining.filter((s) => !baseIds.has(s.fabric_id));
      const orphanTop = orphans.filter((s) => classifySwatch(s) === "top");
      const orphanBase = orphans.filter((s) => classifySwatch(s) !== "top");
      top = [...topMatched, ...orphanTop];
      base = [...baseMatched, ...orphanBase];
    } else {
      for (const s of nonFab) {
        if (classifySwatch(s) === "top") top.push(s);
        else base.push(s);
      }
    }

    // Safety net: even when the DB says the product has only one axis, the
    // swatch strip can still contain both base-family (wood/metal) and
    // top-family (stone/marble/glass/ceramic) materials — this is common on
    // dual-material tables like Praia da Granja (walnut legs + stone top) or
    // Madison Avenue (brass column + onyx base). Rescue any top-family
    // swatches that were pulled into the base group by the axis filter so
    // the drawer's groups always match the GLB material roles.
    const rescuedTops = base.filter((s) => classifySwatch(s) === "top");
    if (rescuedTops.length && top.length === 0) {
      const rescueIds = new Set(rescuedTops.map((s) => s.fabric_id));
      base = base.filter((s) => !rescueIds.has(s.fabric_id));
      top = rescuedTops;
    }

    const splitByClassifier = rescuedTops.length > 0 && !topFilter;

    return { fabricSwatches: fab, baseSwatches: base, topSwatches: top, splitByClassifier };
  }, [swatches, pickAxes.baseOptions, pickAxes.topOptions, topAxisIsFabric]);

  // Build coupled (base, top) combinations from the pick's size_variants,
  // resolving each side to the matching swatch by fuzzy-normalized name.
  // When ≥2 coupled pairs exist AND both axes are populated, the drawer
  // switches from independent Base + Top pickers to a single "Finish
  // Combinations" strip so the user can only pick valid pairs.
  const combinations = useMemo(() => {
    if (topAxisIsFabric) return [];
    if (!pickAxes.pairs.length) return [];
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const findSwatch = (label: string): Swatch | null => {
      const target = norm(label);
      if (!target) return null;
      let best: { swatch: Swatch; score: number } | null = null;
      for (const s of swatches) {
        const n = norm(s.name);
        if (!n) continue;
        let score = 0;
        if (n === target) score = 100;
        else if (n.includes(target) || target.includes(n)) score = 60 + Math.min(n.length, target.length);
        else {
          const tw = target.split(" ").filter(Boolean);
          const nw = new Set(n.split(" "));
          const overlap = tw.filter((w) => nw.has(w)).length;
          if (overlap >= 2) score = 20 + overlap;
        }
        if (score > 0 && (!best || score > best.score)) best = { swatch: s, score };
      }
      return best?.swatch ?? null;
    };
    const out: { base: Swatch; top: Swatch; label: string }[] = [];
    const seen = new Set<string>();
    for (const p of pickAxes.pairs) {
      const b = findSwatch(p.base);
      const t = findSwatch(p.top);
      if (!b || !t) continue;
      const key = `${b.fabric_id}||${t.fabric_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ base: b, top: t, label: `${b.name} · ${t.name}` });
    }
    return out;
  }, [pickAxes.pairs, swatches, topAxisIsFabric]);

  const useCoupled =
    !topAxisIsFabric && combinations.length >= 2 && !!pickAxes.baseAxisLabel && !!pickAxes.topAxisLabel;

  // Resolve which GLB variant should render: user-selected label wins; otherwise
  // the row flagged is_default; otherwise the first row.
  const activeGlbVariant = useMemo(() => {
    if (glbVariants.length === 0) return null;
    if (selectedGlbLabel) {
      const hit = glbVariants.find((v) => v.label === selectedGlbLabel);
      if (hit) return hit;
    }
    return glbVariants.find((v) => v.is_default) || glbVariants[0];
  }, [glbVariants, selectedGlbLabel]);
  const glbUrl = activeGlbVariant?.glb_url ?? null;
  const materialRoles = activeGlbVariant?.material_roles || undefined;
  const hasGlb = !!glbUrl;
  const hasGlbVariantChoices = glbVariants.length > 1;
  const hasSwatches = swatches.length > 0;

  if (!loading && !hasGlb && !hasSwatches) {
    return (
      <div className="mt-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 font-body text-[10px] text-muted-foreground">
        No 3D model or finish swatches on file for this piece.
        {error && <span className="ml-1 text-destructive">({error})</span>}
      </div>
    );
  }


  const fabricSwatch = selectedFabricId
    ? fabricSwatches.find((s) => s.fabric_id === selectedFabricId) ?? null
    : null;
  const baseSwatch = selectedBaseId
    ? baseSwatches.find((s) => s.fabric_id === selectedBaseId) ?? null
    : null;
  const topSwatch = selectedTopId
    ? swatches.find((s) => s.fabric_id === selectedTopId) ?? null
    : null;
  const topIsFabric = topSwatch ? classifySwatch(topSwatch) === "fabric" : false;
  const fabricTextureUrl = fabricSwatch?.image_url ?? (topIsFabric ? topSwatch?.image_url ?? null : null);
  const baseTextureUrl = baseSwatch?.image_url ?? null;
  const topTextureUrl = !topIsFabric ? topSwatch?.image_url ?? null : null;
  const fabricLabel = [fabricSwatch?.name, topIsFabric ? topSwatch?.name : null].filter(Boolean).join(" · ") || null;
  const fabricImg = fabricSwatch?.image_url ?? (topIsFabric ? topSwatch?.image_url ?? null : null);
  const woodLabel = [baseSwatch?.name, topIsFabric ? null : topSwatch?.name].filter(Boolean).join(" · ") || null;
  const woodImg = baseSwatch?.image_url ?? (!topIsFabric ? topSwatch?.image_url ?? null : null);
  const showDraftButton = loading || hasSwatches;
  const canDraft = !loading && (selectedFabricId || selectedBaseId || selectedTopId);

  // Live pricing mirrors TradeProductPage: resolve the selected Base × Top row
  // from full `designer_curator_picks.size_variants` (the public view strips
  // `price_cents`), then fall back to partial/min/base RRP exactly as the page does.
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const axesForPricing = computeVariantAxes(sizeVariants as any);
  const matchAxisValue = (candidate: string | null, values: string[]) => {
    if (!candidate) return null;
    const c = norm(candidate);
    return values.find((v) => {
      const vn = norm(v);
      return vn === c || vn.includes(c) || c.includes(vn);
    }) ?? candidate;
  };
  const selectedBaseAxis = matchAxisValue(baseSwatch?.name ?? null, axesForPricing.baseOptions);
  const selectedTopAxis = matchAxisValue(
    topIsFabric ? (fabricSwatch?.price_tier_label || fabricSwatch?.name || null) : topSwatch?.name ?? null,
    axesForPricing.topOptions,
  );
  const selectedDualSize = selectedGlbLabel
    ? matchAxisValue(selectedGlbLabel, axesForPricing.dualSizeOptions)
    : null;
  const hasDualSize = axesForPricing.dualSizeOptions.length > 1;
  const activeVariantContext = {
    sizeVariants,
    isDualAxis: axesForPricing.isDualAxis,
    isBaseOnly: axesForPricing.isBaseOnly,
    hasSingleAxisSplit: axesForPricing.hasSingleAxisSplit,
    hasDualSize,
    baseOnlyRequiresSize: axesForPricing.isBaseOnly && axesForPricing.baseOptions.length > 1,
    singleAxisParsed: axesForPricing.singleAxisParsed,
  };
  const variantMatch = resolveActiveVariant(
    {
      selectedVariantIdx: null,
      selectedBase: selectedBaseAxis,
      selectedTop: selectedTopAxis,
      selectedDualSize,
      selectedSingleSize: null,
      selectedSingleMaterial: null,
    },
    activeVariantContext,
  );
  const variantPriceCents = typeof variantMatch?.price_cents === "number" && variantMatch.price_cents > 0
    ? variantMatch.price_cents
    : null;
  const partialDualMinCents = resolvePartialDualMinCents(
    { selectedBase: selectedBaseAxis, selectedTop: selectedTopAxis, selectedDualSize },
    { sizeVariants, isDualAxis: axesForPricing.isDualAxis },
  );
  const pricedVariantCents = sizeVariants
    .map((v) => v.price_cents)
    .filter((c): c is number => typeof c === "number" && c > 0);
  const minVariantCents = pricedVariantCents.length ? Math.min(...pricedVariantCents) : null;
  const dualSelectionMade = axesForPricing.isDualAxis && !!(selectedBaseAxis || selectedTopAxis || selectedDualSize);
  const dualSelectionUnpriced = dualSelectionMade && !variantPriceCents && partialDualMinCents == null;
  const livePriceCents = sizeVariants.length
    ? (variantPriceCents ?? (dualSelectionUnpriced ? null : (partialDualMinCents ?? minVariantCents)))
    : (tradeMeta.rrpPriceCents ?? tradeMeta.tradePriceCents);
  const isFromPrice = sizeVariants.length > 0 && !variantPriceCents && !dualSelectionUnpriced && livePriceCents != null;
  const draftParams = new URLSearchParams();
  draftParams.set("product", pickId);
  if (fabricLabel) draftParams.set("fabric", fabricLabel);
  if (fabricImg) draftParams.set("fabricImg", fabricImg);
  if (woodLabel) draftParams.set("wood", woodLabel);
  if (woodImg) draftParams.set("woodImg", woodImg);

  const renderGroup = (
    label: string,
    list: Swatch[],
    selectedId: string | null,
    setSelected: (id: string | null) => void,
  ) => {
    if (list.length === 0) return null;
    return (
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-display text-[9px] uppercase tracking-widest text-muted-foreground">
            {label} ({list.length})
          </span>
          {selectedId && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="font-body text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-none">
          {list.map((s) => {
            const isSelected = s.fabric_id === selectedId;
            return (
              <button
                type="button"
                key={s.fabric_id}
                onClick={() =>
                  setSelected(selectedId === s.fabric_id ? null : s.fabric_id)
                }
                className="shrink-0 w-20 flex flex-col items-center gap-0.5 group focus:outline-none"
                title={[s.name, s.supplier, s.category].filter(Boolean).join(" · ")}
                aria-pressed={isSelected}
              >
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={s.name}
                    loading="lazy"
                    className={`h-11 w-20 rounded object-cover bg-muted border transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border/60 group-hover:border-foreground/40"
                    }`}
                  />
                ) : (
                  <div
                    className={`h-11 w-20 rounded bg-muted border ${
                      isSelected ? "border-primary ring-2 ring-primary/40" : "border-border/60"
                    }`}
                  />
                )}
                <span
                  className={`w-20 whitespace-normal break-words text-center font-body text-[8px] leading-tight ${
                    isSelected ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const hasSelection = selectedFabricId || selectedBaseId || selectedTopId;
  const resetFinishes = () => {
    setSelectedFabricId(null);
    setSelectedBaseId(null);
    setSelectedTopId(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/40 p-2 space-y-2 animate-fade-in">
      {hasSelection && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={resetFinishes}
            className="flex items-center gap-1 font-body text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw size={10} />
            Reset finishes
          </button>
        </div>
      )}
      {hasGlb && (
        <div className="max-w-[240px] space-y-1.5">
          {hasGlbVariantChoices && (
            <div>
              <div className="mb-1 font-display text-[9px] uppercase tracking-widest text-muted-foreground">
                Size ({glbVariants.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {glbVariants.map((v) => {
                  const isActive = activeGlbVariant?.glb_url === v.glb_url;
                  return (
                    <button
                      key={v.label + v.glb_url}
                      type="button"
                      onClick={() => setSelectedGlbLabel(v.label)}
                      className={`rounded-full border px-2 py-0.5 font-body text-[9px] uppercase tracking-widest transition-colors ${
                        isActive
                          ? "border-foreground bg-foreground text-background"
                          : "border-border/60 text-muted-foreground hover:border-foreground/60 hover:text-foreground"
                      }`}
                      title={v.label}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <Product3DViewer
            key={glbUrl!}
            url={glbUrl!}
            alt={title}
            poster={poster}
            fabricTextureUrl={fabricTextureUrl}
            baseTextureUrl={baseTextureUrl}
            topTextureUrl={topTextureUrl}
            materialRoles={materialRoles}
          />
        </div>
      )}
      {hasSwatches && (
        <div className="space-y-2">
          {useCoupled ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-display text-[9px] uppercase tracking-widest text-muted-foreground">
                  Finish Combinations ({combinations.length})
                </span>
                {(selectedBaseId || selectedTopId) && (
                  <button
                    type="button"
                    onClick={() => { setSelectedBaseId(null); setSelectedTopId(null); }}
                    className="font-body text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-none">
                {combinations.map((c) => {
                  const isSelected =
                    c.base.fabric_id === selectedBaseId && c.top.fabric_id === selectedTopId;
                  return (
                    <button
                      type="button"
                      key={`${c.base.fabric_id}-${c.top.fabric_id}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedBaseId(null);
                          setSelectedTopId(null);
                        } else {
                          setSelectedBaseId(c.base.fabric_id);
                          setSelectedTopId(c.top.fabric_id);
                        }
                      }}
                      className="shrink-0 w-36 flex flex-col items-center gap-0.5 group focus:outline-none"
                      title={c.label}
                      aria-pressed={isSelected}
                    >
                      <div
                         className={`flex h-11 w-36 overflow-hidden rounded border transition-all ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border/60 group-hover:border-foreground/40"
                        }`}
                      >
                        {c.base.image_url ? (
                          <img src={c.base.image_url} alt={c.base.name} loading="lazy" className="h-full w-1/2 object-cover bg-muted" />
                        ) : (
                          <div className="h-full w-1/2 bg-muted" />
                        )}
                        {c.top.image_url ? (
                          <img src={c.top.image_url} alt={c.top.name} loading="lazy" className="h-full w-1/2 object-cover bg-muted" />
                        ) : (
                          <div className="h-full w-1/2 bg-muted" />
                        )}
                      </div>
                      <span
                         className={`w-36 whitespace-normal break-words text-center font-body text-[8px] leading-tight ${
                          isSelected ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {renderGroup(
                splitByClassifier
                  ? "Base (wood · metal)"
                  : (pickAxes.baseAxisLabel && formatVariantAxisLabel(pickAxes.baseAxisLabel)) || "Base (wood · metal)",
                baseSwatches,
                selectedBaseId,
                setSelectedBaseId,
              )}
              {renderGroup(
                splitByClassifier
                  ? "Top (stone · marble · glass)"
                  : (pickAxes.topAxisLabel && formatVariantAxisLabel(pickAxes.topAxisLabel)) || "Top (stone · marble · glass)",
                topSwatches,
                selectedTopId,
                setSelectedTopId,
              )}
            </>
          )}
          {renderGroup("Fabrics", fabricSwatches, selectedFabricId, setSelectedFabricId)}
        </div>
      )}
      {showDraftButton && (
        <>
          {canDraft && (
            <div className="mt-1 rounded-md border border-border/60 bg-background/60 px-2.5 py-2 space-y-1">
              <div className="font-display text-[9px] uppercase tracking-widest text-muted-foreground">
                Current Selection
              </div>
              <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5 font-body text-[10px] leading-tight text-foreground">
                <dt className="text-muted-foreground">SKU</dt>
                <dd className="tabular-nums">MA-{pickId.replace(/-/g, "").slice(0, 8).toUpperCase()}</dd>
                {woodLabel && (
                  <>
                    <dt className="text-muted-foreground">Frame</dt>
                    <dd className="break-words">{woodLabel}</dd>
                  </>
                )}
                {fabricLabel && (
                  <>
                    <dt className="text-muted-foreground">Seating</dt>
                    <dd className="break-words">{fabricLabel}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">
                  Trade Price{tradeMeta.currency ? ` (${tradeMeta.currency})` : ""}
                </dt>
                <dd>
                  {livePriceCents
                    ? `${isFromPrice ? "From " : ""}${
                        tradeMeta.currency === "USD" ? "$" :
                        tradeMeta.currency === "GBP" ? "£" :
                        tradeMeta.currency === "SGD" ? "S$" : "€"
                      }${(livePriceCents / 100).toLocaleString()}`
                    : "Price upon Request"}
                </dd>
                <dt className="text-muted-foreground">Lead Time</dt>
                <dd>{tradeMeta.leadTime || "—"}</dd>
                {projectName && !editingProject && (
                  <>
                    <dt className="text-muted-foreground">Project</dt>
                    <dd className="flex items-center gap-1 break-words">
                      <span className="truncate">{projectName}</span>
                      <button
                        type="button"
                        onClick={() => { setProjectDraft(projectName); setEditingProject(true); }}
                        className="text-muted-foreground/70 hover:text-foreground shrink-0"
                        aria-label="Rename project"
                      >
                        <Pencil size={9} />
                      </button>
                    </dd>
                  </>
                )}
              </dl>
              {(!projectName || editingProject) && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = projectDraft.trim();
                    if (!name) return;
                    updateConciergeSession({ projectName: name });
                    setEditingProject(false);
                  }}
                  className="mt-1.5 space-y-1"
                >
                  <label className="font-body text-[10px] text-muted-foreground block">
                    {editingProject
                      ? "Rename this project folder"
                      : "Save this to a project — what name or client folder?"}
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={projectDraft}
                      onChange={(e) => setProjectDraft(e.target.value)}
                      placeholder="e.g. Apt 4B"
                      autoFocus={editingProject}
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-body text-[11px] focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    />
                    <button
                      type="submit"
                      disabled={!projectDraft.trim()}
                      className="rounded-md bg-foreground text-background px-2 py-1 font-body text-[10px] uppercase tracking-widest disabled:opacity-40"
                    >
                      <Check size={11} />
                    </button>
                    {!editingProject && (
                      <button
                        type="button"
                        onClick={() => {
                          updateConciergeSession({ projectName: "" });
                        }}
                        className="rounded-md border border-border bg-background px-2 py-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                      >
                        Skip
                      </button>
                    )}
                    {editingProject && (
                      <button
                        type="button"
                        onClick={() => setEditingProject(false)}
                        className="rounded-md border border-border bg-background px-2 py-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
          <div className="mt-1 flex flex-col sm:flex-row gap-1.5">
            {canDraft ? (
              <Link
                to={(() => {
                  const p = new URLSearchParams(draftParams);
                  if (projectName) p.set("project", projectName);
                  return `/trade/tearsheets?${p.toString()}`;
                })()}
                onClick={() => {
                  updateConciergeSession({
                    product: { id: pickId, title, source: "curator" },
                    finishes: {
                      fabric: fabricLabel,
                      fabricImg,
                      wood: woodLabel,
                      woodImg,
                      variant: null,
                    },
                    locked: true,
                  });
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-foreground/30 bg-foreground text-background px-2.5 py-1.5 font-body text-[10px] uppercase tracking-widest hover:bg-foreground/90 transition-colors"
              >
                <FileText size={11} />
                Generate Tearsheet
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-foreground/30 bg-foreground text-background px-2.5 py-1.5 font-body text-[10px] uppercase tracking-widest opacity-50 cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <FileText size={11} />
                )}
                {loading ? "Loading finishes…" : "Generate Tearsheet"}
              </button>
            )}
            {canDraft && tradeMeta.tradeProductId ? (
              <AddToProjectPopover
                productId={tradeMeta.tradeProductId}
                productName={title}
                defaultProjectName={projectName || undefined}
              >
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-foreground/30 bg-background text-foreground px-2.5 py-1.5 font-body text-[10px] uppercase tracking-widest hover:bg-foreground/5 transition-colors"
                >
                  <FolderPlus size={11} />
                  Add to Project Board
                </button>
              </AddToProjectPopover>
            ) : (
              <button
                type="button"
                disabled
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-foreground/30 bg-background text-foreground px-2.5 py-1.5 font-body text-[10px] uppercase tracking-widest opacity-50 cursor-not-allowed transition-colors"
              >
                <FolderPlus size={11} />
                Add to Project Board
              </button>
            )}
          </div>
          {tradeMeta.tradeProductId && (
            <Link
              to={(() => {
                const p = new URLSearchParams();
                if (selectedBaseAxis) p.set("base", selectedBaseAxis);
                if (selectedTopAxis) p.set("top", selectedTopAxis);
                if (selectedDualSize) p.set("size", selectedDualSize);
                if (fabricSwatch?.name) p.set("fabric", fabricSwatch.name);
                // Preserve the pick's base currency so the product page opens
                // in the same currency the drawer displayed — never the user's
                // auto-defaulted display currency.
                if (tradeMeta.currency) p.set("ccy", tradeMeta.currency);
                const qs = p.toString();
                return `/trade/products/${tradeMeta.tradeProductId}${qs ? `?${qs}` : ""}`;
              })()}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-md border border-border/60 bg-background/60 text-foreground px-2.5 py-1.5 font-body text-[10px] uppercase tracking-widest hover:bg-foreground/5 transition-colors"
              title="Open the full product page with live pricing for the selected finishes"
            >
              <ExternalLink size={11} />
              View on Product Page
            </Link>
          )}
        </>
      )}
    </div>
  );
}

export default PickAssetDrawer;
