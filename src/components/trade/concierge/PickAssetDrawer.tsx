import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Product3DViewer from "@/components/trade/Product3DViewer";
import { FileText, Loader2 } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [materialRoles, setMaterialRoles] = useState<
    Record<string, "fabric" | "base" | "top" | "ignore"> | undefined
  >(undefined);
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null);
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [selectedTopId, setSelectedTopId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const prodRes = await supabase
        .from("trade_products")
        .select("id, glb_url, image_url")
        .eq("source_pick_id", pickId)
        .maybeSingle();

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
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickId]);

  const { fabricSwatches, baseSwatches, topSwatches } = useMemo(() => {
    const base: Swatch[] = [];
    const top: Swatch[] = [];
    const fab: Swatch[] = [];
    for (const s of swatches) {
      const role = classifySwatch(s);
      if (role === "fabric") fab.push(s);
      else if (role === "top") top.push(s);
      else base.push(s);
    }
    return { fabricSwatches: fab, baseSwatches: base, topSwatches: top };
  }, [swatches]);

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

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/40 p-2 space-y-2 animate-fade-in">
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
          {renderGroup("Base (wood · metal)", baseSwatches, selectedBaseId, setSelectedBaseId)}
          {renderGroup("Top (stone · marble · glass)", topSwatches, selectedTopId, setSelectedTopId)}
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
            Draft Tearsheet with These Finishes
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
            {loading ? "Loading finishes…" : "Draft Tearsheet with These Finishes"}
          </button>
        )
      )}
    </div>
  );
}

export default PickAssetDrawer;
