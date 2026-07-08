import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Product3DViewer from "@/components/trade/Product3DViewer";
import { FileText, Loader2, RotateCcw } from "lucide-react";
import { updateConciergeSession } from "@/hooks/useConciergeSession";
import { computeVariantAxes } from "@/lib/parseSizeVariants";
import { makeSwatchAxisFilter } from "@/lib/finishDuplication";
import { formatVariantAxisLabel } from "@/lib/variantPlaceholders";

interface Swatch {
  fabric_id: string;
  name: string;
  image_url: string | null;
  supplier: string | null;
  category: string | null;
  sort_order: number | null;
}

interface Props {
  pickId: string;
  title: string;
}

type FinishRole = "fabric" | "base" | "top";

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
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [materialRoles, setMaterialRoles] = useState<
    Record<string, "fabric" | "base" | "top" | "ignore"> | undefined
  >(undefined);
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

  // Mirror selections to sessionStorage on every change so a collapse/expand
  // (or an "unlock → re-lock") cycle restores the previous picks verbatim.
  useEffect(() => {
    try {
      const payload = {
        fabricId: selectedFabricId,
        baseId: selectedBaseId,
        topId: selectedTopId,
      };
      if (!selectedFabricId && !selectedBaseId && !selectedTopId) {
        sessionStorage.removeItem(storageKey);
      } else {
        sessionStorage.setItem(storageKey, JSON.stringify(payload));
      }
    } catch {
      /* quota / disabled — ignore */
    }
  }, [storageKey, selectedFabricId, selectedBaseId, selectedTopId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [prodRes, pickRes] = await Promise.all([
        supabase
          .from("trade_products")
          .select("id, glb_url, image_url")
          .eq("source_pick_id", pickId)
          .maybeSingle(),
        supabase
          .from("designer_curator_picks_public")
          .select("size_variants, base_axis_label, top_axis_label")
          .eq("id", pickId)
          .maybeSingle(),
      ]);

      const tpId = (prodRes.data as any)?.id as string | undefined;

      const [swRes, glbVarRes] = await Promise.all([
        supabase
          .from("product_fabric_swatches_public")
          .select("fabric_id, name, image_url, supplier, category, sort_order")
          .eq("pick_id", pickId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true }),
        tpId
          ? supabase
              .from("trade_product_glb_variants")
              .select("glb_url, is_default, material_roles")
              .eq("product_id", tpId)
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (cancelled) return;
      if (prodRes.error) setError(prodRes.error.message);

      const variants = ((glbVarRes as any)?.data as any[]) || [];
      const defaultVar = variants.find((v) => v.is_default) || variants[0];
      const resolvedGlb =
        defaultVar?.glb_url ?? ((prodRes.data as any)?.glb_url ?? null);
      setGlbUrl(resolvedGlb);
      setMaterialRoles(defaultVar?.material_roles || undefined);
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

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickId]);

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
      pickAxes.topOptions.length > 0 ? makeSwatchAxisFilter(pickAxes.topOptions) : null;

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
  }, [swatches, pickAxes.baseOptions, pickAxes.topOptions]);

  // Build coupled (base, top) combinations from the pick's size_variants,
  // resolving each side to the matching swatch by fuzzy-normalized name.
  // When ≥2 coupled pairs exist AND both axes are populated, the drawer
  // switches from independent Base + Top pickers to a single "Finish
  // Combinations" strip so the user can only pick valid pairs.
  const combinations = useMemo(() => {
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
  }, [pickAxes.pairs, swatches]);

  const useCoupled =
    combinations.length >= 2 && !!pickAxes.baseAxisLabel && !!pickAxes.topAxisLabel;

  const hasGlb = !!glbUrl;
  const hasSwatches = swatches.length > 0;

  if (!loading && !hasGlb && !hasSwatches) {
    return (
      <div className="mt-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 font-body text-[10px] text-muted-foreground">
        No 3D model or finish swatches on file for this piece.
        {error && <span className="ml-1 text-destructive">({error})</span>}
      </div>
    );
  }


  const fabricTextureUrl = selectedFabricId
    ? fabricSwatches.find((s) => s.fabric_id === selectedFabricId)?.image_url ?? null
    : null;
  const baseTextureUrl = selectedBaseId
    ? baseSwatches.find((s) => s.fabric_id === selectedBaseId)?.image_url ?? null
    : null;
  const topTextureUrl = selectedTopId
    ? topSwatches.find((s) => s.fabric_id === selectedTopId)?.image_url ?? null
    : null;

  const fabricSwatch = selectedFabricId
    ? fabricSwatches.find((s) => s.fabric_id === selectedFabricId) ?? null
    : null;
  const baseSwatch = selectedBaseId
    ? baseSwatches.find((s) => s.fabric_id === selectedBaseId) ?? null
    : null;
  const showDraftButton = loading || hasSwatches;
  const canDraft = !loading && (selectedFabricId || selectedBaseId || selectedTopId);
  const draftParams = new URLSearchParams();
  draftParams.set("product", pickId);
  if (fabricSwatch?.name) draftParams.set("fabric", fabricSwatch.name);
  if (fabricSwatch?.image_url) draftParams.set("fabricImg", fabricSwatch.image_url);
  if (baseSwatch?.name) draftParams.set("wood", baseSwatch.name);
  if (baseSwatch?.image_url) draftParams.set("woodImg", baseSwatch.image_url);

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
                className="shrink-0 w-11 flex flex-col items-center gap-0.5 group focus:outline-none"
                title={[s.name, s.supplier, s.category].filter(Boolean).join(" · ")}
                aria-pressed={isSelected}
              >
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={s.name}
                    loading="lazy"
                    className={`h-11 w-11 rounded object-cover bg-muted border transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border/60 group-hover:border-foreground/40"
                    }`}
                  />
                ) : (
                  <div
                    className={`h-11 w-11 rounded bg-muted border ${
                      isSelected ? "border-primary ring-2 ring-primary/40" : "border-border/60"
                    }`}
                  />
                )}
                <span
                  className={`w-11 truncate text-center font-body text-[8px] leading-tight ${
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
        <div className="max-w-[240px]">
          <Product3DViewer
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
          {renderGroup("Fabrics", fabricSwatches, selectedFabricId, setSelectedFabricId)}
        </div>
      )}
      {showDraftButton && (
        canDraft ? (
          <Link
            to={`/trade/tearsheets?${draftParams.toString()}`}
            onClick={() => {
              // Persist product + locked finishes into the cross-surface
              // concierge session so the Tearsheet Builder and Quote flow
              // can carry them forward even if the URL params are stripped.
              updateConciergeSession({
                product: { id: pickId, title, source: "curator" },
                finishes: {
                  fabric: fabricSwatch?.name ?? null,
                  fabricImg: fabricSwatch?.image_url ?? null,
                  wood: baseSwatch?.name ?? null,
                  woodImg: baseSwatch?.image_url ?? null,
                  variant: null,
                },
                locked: true,
              });
            }}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-md border border-foreground/30 bg-foreground text-background px-2.5 py-1.5 font-body text-[10px] uppercase tracking-widest hover:bg-foreground/90 transition-colors"
          >
            <FileText size={11} />
            Generate Tearsheet
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-foreground/30 bg-foreground text-background px-2.5 py-1.5 font-body text-[10px] uppercase tracking-widest opacity-50 cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <FileText size={11} />
            )}
            {loading ? "Loading finishes…" : "Generate Tearsheet"}
          </button>
        )
      )}
    </div>
  );
}

export default PickAssetDrawer;
