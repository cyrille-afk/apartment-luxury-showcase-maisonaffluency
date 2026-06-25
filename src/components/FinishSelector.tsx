import { useEffect, useState } from "react";
import { ChevronDown, ZoomIn, X, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import SpecGlyph from "@/components/product/SpecGlyph";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Fabric {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  supplier: string | null;
  /** Upholstery price-tier label for this product (from product_fabrics.price_tier_label). */
  price_tier_label?: string | null;
  /** Per-linear-meter price (in cents) for this fabric/leather. */
  price_per_lm_cents?: number | null;
  /** Fabric category tier (A–E). */
  tier?: string | null;
  /** Currency of price_per_lm_cents. */
  currency?: string | null;
  /** 1-based gallery image indices that depict this swatch on the linked product. */
  image_indices?: number[] | null;
  /** Wood-finish frame price override (product_fabrics.price_cents_a). */
  frame_price_cents?: number | null;
  /** Currency of frame_price_cents. */
  frame_price_currency?: string | null;
}

export interface SelectedFinishInfo {
  id: string;
  name: string;
  tier: string | null;
  price_per_lm_cents: number | null;
  currency: string;
}

interface FinishSelectorProps {
  /** designer_curator_picks.id — required to look up linked fabrics. */
  pickId: string | null | undefined;
  className?: string;
  /** Optional product title shown in the zoom popup header. */
  productTitle?: string;
  /**
   * Fires when the user picks a fabric/leather swatch (or COM/COL tile).
   * Receives the raw upholstery tier label (e.g. "ECART fabric", "Leather",
   * "COM fabric"). The product page uses this to auto-select the matching
   * row in the Size × Upholstery price matrix.
   */
  onUpholsteryTierChange?: (rawTier: string | null) => void;
  /**
   * Fires when the user picks a fabric/leather swatch with pricing details
   * (tier, per-LM price, currency). Used to compute the upholstery upcharge
   * added on top of the frame variant price.
   */
  onFabricChange?: (fabric: SelectedFinishInfo | null) => void;
  /**
   * Fires after the linked-fabric list is fetched. `true` when this product
   * has one or more real linked fabric/leather swatches (excludes the
   * synthetic COM/COL tiles). Product pages use this to hide the redundant
   * upholstery-finish dropdown when the swatch picker covers the same axis.
   */
  onHasFabricsChange?: (has: boolean) => void;
  /**
   * Fires when the user picks a wood-finish swatch. Receives the swatch
   * name (which must match the Frame axis value in size_variants) so the
   * product page can drive the Base × Top price matrix in sync.
   */
  onWoodFinishChange?: (woodName: string | null) => void;
  /**
   * Fires when the selected wood-finish swatch carries a frame-price override
   * (product_fabrics.price_cents_a). The product page uses it as the RRP base
   * and adds the fabric per-LM upcharge on top.
   */
  onWoodFinishPricingChange?: (info: { id: string; name: string; price_cents: number; currency: string; image_url: string | null } | null) => void;
  /** Fires with the list of linked wood-swatch names after fetch. */
  onWoodFinishesAvailable?: (names: string[]) => void;
  /** Trade-only: include fabric price/tier fields for quote upcharge math. */
  includePricing?: boolean;
  /**
   * Fires when the user picks any swatch (fabric, leather, or wood) with
   * mapped image indices. Receives the 1-based gallery indices the product
   * page should jump the hero gallery to. Null clears the override.
   */
  onSwatchImagesChange?: (imageIndices: number[] | null) => void;
  /**
   * Per-product override for the wood-swatch accordion label.
   * When omitted, falls back to "Select the Wood Finish of the Frame".
   */
  woodLabel?: string | null;
  /**
   * When false, the upholstery (fabric/leather + COM/COL) accordion is hidden
   * and only the wood/finish swatch picker is rendered. Used on non-upholstered
   * products (e.g. wood/rattan benches) that still have linked frame finishes.
   */
  showUpholsterySection?: boolean;
  /**
   * When false, the wood/stone/metal frame-finish swatch accordion is hidden.
   * Used by product pages that already render an explicit Base × Top variant
   * dropdown pair covering the same axis (e.g. a pendant with "Rod Finish" ×
   * "Diffuser" dual-axis size_variants) — otherwise the swatch picker would
   * duplicate the dropdown.
   */
  showWoodSection?: boolean;
  /**
   * Optional filter restricting which wood-bucket swatches are shown in the
   * primary frame-finish group. Used by dual-axis products (e.g. pendant with
   * "Rod Finish" × "Diffuser") so the rod-finish group doesn't accidentally
   * pull in diffuser swatches like alabaster that also fall into the
   * catch-all non-upholstery bucket.
   * Return true to keep the swatch.
   */
  woodFilter?: (swatchName: string) => boolean;
  /**
   * Optional second swatch group for the Top axis on dual-axis products
   * (e.g. the diffuser on a pendant). When provided, swatches matching
   * `topFilter` render in their own accordion below the base group.
   */
  topFilter?: (swatchName: string) => boolean;
  /** Label for the top-axis swatch accordion (e.g. "Select Your Diffuser"). */
  topLabel?: string | null;
  /** Fires when the user picks a top-axis swatch. */
  onTopFinishChange?: (name: string | null) => void;
  /**
   * Fires whenever the currently-selected wood/top finish swatches change.
   * Receives the names of selected finishes that have NO mapped gallery
   * images (`image_indices` empty). The product page surfaces these on the
   * quote/bespoke message so designers know the visual was unmapped.
   */
  onFinishesMissingImagesChange?: (names: string[]) => void;
  /**
   * Currently-visible gallery image index (0-based). When provided, the
   * fabric accordion auto-selects the swatch whose `image_indices` includes
   * this image so the label always matches what the user sees in the hero
   * gallery on page load.
   */
  currentGalleryIndex?: number;
}

const normalizeFabricCategory = (category: string | null | undefined) => {
  const raw = (category || "").trim().toLowerCase();
  if (raw === "rug finish" || raw === "rug finishes" || raw === "rug") {
    return "Rug Finish";
  }
  if (raw === "upholstery" || raw === "leather" || raw === "fabric" || raw === "fabric & leather") {
    return "Fabric & Leather";
  }
  // Woven natural covers (seat/back surface, not the frame) get their own group
  // so the picker can label them "Cover" instead of "Frame".
  if (raw === "rattan" || raw === "cane" || raw === "wicker" || raw === "cover") {
    return "Cover";
  }
  if (raw === "metal") return "Metal";
  if (raw === "glass") return "Glass";
  if (raw === "stone" || raw === "marble" || raw === "alabaster" || raw === "onyx") return "Stone";
  if (raw === "ceramic") return "Ceramic";
  if (raw === "wood" || raw === "rattan finish" || raw === "tinted rattan") return "Wood";
  if (raw) return "Other";
  return "Fabric & Leather";
};

const isFabricCategory = (fabric: Fabric) => {
  const category = normalizeFabricCategory(fabric.category);
  return category === "Fabric & Leather" || category === "Rug Finish";
};
const isCoverCategory = (fabric: Fabric) => normalizeFabricCategory(fabric.category) === "Cover";
const isFinishCategory = (fabric: Fabric) => !isFabricCategory(fabric) && !isCoverCategory(fabric);

/**
 * Pick the row icon (left of the accordion label) for a frame-finish group.
 * Falls back to the label hint when category alone is ambiguous (e.g. a
 * "Rod Finish" group that mixes metal patinas, or a "Diffuser" group that
 * mixes alabaster + frosted glass).
 */
const pickFinishGlyph = (
  tiles: Fabric[],
  label?: string | null,
): "wood" | "metal" | "stone" | "glass" | "finish" => {
  const cats = tiles
    .map((t) => (t.category || "").trim().toLowerCase())
    .filter(Boolean);
  const has = (k: string) => cats.some((c) => c === k);
  const every = (k: string) => cats.length > 0 && cats.every((c) => c === k);
  const lbl = (label || "").toLowerCase();

  // Label is the UI truth: force the visible row icon from the visible row text.
  if (/\bmetal\b|\brod\b|\bhardware\b/.test(lbl)) return "metal";
  if (/\bglass\b|\bdiffuser\b|\bshade\b|\bglobe\b/.test(lbl)) return "glass";

  if (every("wood")) return "wood";
  if (every("metal")) return "metal";
  if (every("stone")) return "stone";
  if (every("glass")) return "glass";

  // Mixed tiles → bias by the accordion label first, then by majority.
  if (/\brod\b|\bframe\b|\bbase\b|\bhardware\b/.test(lbl) && has("metal")) return "metal";
  if (/\bdiffuser\b|\bshade\b|\bglobe\b|\bbulb\b/.test(lbl) && (has("glass") || has("stone"))) {
    return has("glass") ? "glass" : "stone";
  }

  // Majority wins among recognised material categories.
  const tally: Record<string, number> = {};
  for (const c of cats) if (["wood", "metal", "stone", "glass"].includes(c)) tally[c] = (tally[c] || 0) + 1;
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top === "wood" || top === "metal" || top === "stone" || top === "glass") return top;

  return "finish";
};


/**
 * Fabric / finish selector accordion shown on upholstered products
 * (Trade + Public). Tiles are grouped by category (Upholstery, Wood, …)
 * with a COM ("Customer's Own Material") tile always offered.
 */
export default function FinishSelector({ pickId, className, productTitle, onUpholsteryTierChange, onFabricChange, onHasFabricsChange, onWoodFinishChange, onWoodFinishPricingChange, onWoodFinishesAvailable, includePricing = false, onSwatchImagesChange, woodLabel, showUpholsterySection = true, showWoodSection = true, woodFilter, topFilter, topLabel, onTopFinishChange, onFinishesMissingImagesChange, currentGalleryIndex }: FinishSelectorProps) {

  const isRugProduct = !!productTitle && /\brug\b/i.test(productTitle);

  const [open, setOpen] = useState(false);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null);
  const [selectedWoodId, setSelectedWoodId] = useState<string | null>(null);
  const [selectedTopId, setSelectedTopId] = useState<string | null>(null);
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<Fabric | null>(null);
  const [allowComCol, setAllowComCol] = useState<boolean>(true);

  // Fetch the per-product "allow customer's own material" flag from the public
  // mirror so we can suppress COM/COL tiles on products where they don't apply
  // (e.g. Alinea Twin Upholstered — leather seat is supplier-supplied only).
  useEffect(() => {
    if (!pickId) { setAllowComCol(true); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("designer_curator_picks_public")
        .select("allow_com_col")
        .eq("id", pickId)
        .maybeSingle();
      if (cancelled) return;
      setAllowComCol(data?.allow_com_col !== false);
    })();
    return () => { cancelled = true; };
  }, [pickId]);



  useEffect(() => {
    if (!pickId) {
      setFabrics([]);
      onHasFabricsChange?.(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const query = includePricing
        ? (supabase as any)
            .from("product_fabrics")
            .select("sort_order, price_tier_label, image_indices, price_cents_a, fabric:fabrics(id, name, image_url, category, supplier, is_active, price_per_lm_cents, tier, currency)")
            .eq("pick_id", pickId)
            .order("sort_order", { ascending: true })
        : (supabase as any)
            .from("product_fabric_swatches_public")
            .select("sort_order, price_tier_label, image_indices, fabric_id, name, image_url, category, supplier, is_active")
            .eq("pick_id", pickId)
            .order("sort_order", { ascending: true });
      const { data, error } = await query;
      if (cancelled || error) return;
      const list: Fabric[] = (data || [])
        .map((row: any) => includePricing
          ? row.fabric && {
              ...row.fabric,
              price_tier_label: row.price_tier_label ?? null,
              image_indices: row.image_indices ?? null,
              frame_price_cents: row.price_cents_a ?? null,
              frame_price_currency: row.fabric?.currency ?? "EUR",
            }
          : {
              id: row.fabric_id,
              name: row.name,
              image_url: row.image_url,
              category: row.category,
              supplier: row.supplier,
              is_active: row.is_active,
              price_tier_label: row.price_tier_label ?? null,
              image_indices: row.image_indices ?? null,
            })
        .filter((f: any) => f && f.is_active !== false)
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          image_url: f.image_url,
          category: normalizeFabricCategory(f.category),
          supplier: f.supplier,
          price_tier_label: f.price_tier_label ?? null,
          price_per_lm_cents: f.price_per_lm_cents ?? null,
          tier: f.tier ?? null,
          currency: f.currency ?? "EUR",
          image_indices: Array.isArray(f.image_indices) ? f.image_indices : null,
          frame_price_cents: f.frame_price_cents ?? null,
          frame_price_currency: f.frame_price_currency ?? "EUR",
        }));
      setFabrics(list);
      onHasFabricsChange?.(list.some(isFabricCategory));
      onWoodFinishesAvailable?.(list.filter(isFinishCategory).map((f) => f.name));
      // Do NOT auto-select a default fabric swatch — the accordion label
      // should start empty so the user makes an intentional choice and we
      // don't mislead them with a name that doesn't match the gallery image.
      // We still notify the parent of the baseline upholstery tier so the
      // RRP math has a sensible default until the user picks a swatch.
      const defaultFabric = list.find(isFabricCategory) || null;
      setSelectedFabricId(null);
      if (defaultFabric) {
        onUpholsteryTierChange?.(defaultFabric.price_tier_label ?? null);
      }
      onFabricChange?.(null);

      // Do NOT auto-select a default wood/finish swatch — the dropdown should
      // start empty so the user makes an intentional choice (the product's
      // base price reflects an unselected state).
      setSelectedWoodId(null);
      onWoodFinishChange?.(null);
      onWoodFinishPricingChange?.(null);

      setSelectedCoverId(null);



    })();
    return () => {
      cancelled = true;
    };
    }, [pickId, includePricing, onHasFabricsChange]);


  const grouped = fabrics.reduce<Record<string, Fabric[]>>((acc, f) => {
    // Merge legacy/blank fabric buckets into Fabric & Leather; only explicit Wood stays Wood.
    const key = normalizeFabricCategory(f.category);
    (acc[key] ||= []).push(f);
    return acc;
  }, {});
  const groupOrder = ["Rug Finish", "Fabric & Leather", "Wood", "Metal", "Glass", "Stone", "Ceramic", "Other", "Cover"];
  const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
    const ai = groupOrder.indexOf(a);
    const bi = groupOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });


  const comTile: Fabric = {
    id: "__com__",
    name: "COM — Customer's Own Fabric",
    image_url: null,
    category: "Fabric & Leather",
    supplier: null,
    price_tier_label: "COM fabric",
  };
  const colTile: Fabric = {
    id: "__col__",
    name: "COL — Customer's Own Leather",
    image_url: null,
    category: "Fabric & Leather",
    supplier: null,
    // No dedicated COL tier on most pieces — Customer's Own Leather is priced
    // at the standard Leather tier; the variant matrix already exposes that.
    price_tier_label: "Leather",
  };
  // Inject COM + COL at the end of the Fabric & Leather group so customers see
  // their "own material" options alongside the curated swatches — unless this
  // product opts out (designer_curator_picks.allow_com_col = false).
  if (allowComCol && showUpholsterySection && !isRugProduct) {
    if (grouped["Fabric & Leather"]) {
      grouped["Fabric & Leather"] = [...grouped["Fabric & Leather"], comTile, colTile];
    } else {
      grouped["Fabric & Leather"] = [comTile, colTile];
      if (!sortedGroupKeys.includes("Fabric & Leather")) sortedGroupKeys.unshift("Fabric & Leather");
    }
  }


  const selectedFabricItem =
    selectedFabricId === "__com__"
      ? comTile
      : selectedFabricId === "__col__"
      ? colTile
      : fabrics.find((f) => f.id === selectedFabricId) || null;
  const selectedWoodItem = fabrics.find((f) => f.id === selectedWoodId) || null;
  const selectedTopItem = fabrics.find((f) => f.id === selectedTopId) || null;
  const selectedCoverItem = fabrics.find((f) => f.id === selectedCoverId) || null;

  // Notify parent when the user has selected wood/top finishes that lack
  // mapped gallery images, so quote/bespoke messages can flag them.
  useEffect(() => {
    if (!onFinishesMissingImagesChange) return;
    const missing: string[] = [];
    for (const item of [selectedWoodItem, selectedTopItem]) {
      if (item && (!item.image_indices || item.image_indices.length === 0)) {
        missing.push(item.name);
      }
    }
    onFinishesMissingImagesChange(missing);
  }, [selectedWoodItem?.id, selectedTopItem?.id, onFinishesMissingImagesChange]);

  // Auto-select the fabric/leather swatch whose mapped image_indices include
  // the image currently visible in the hero gallery. Keeps the accordion
  // label honest on first paint (e.g. when the gallery opens on Belsuede-
  // Deserto, the selector shows "Belsuede-Deserto" — not the first sort_order
  // fabric). The user's own swatch clicks still win because they update both
  // selectedFabricId and the gallery index in the same gesture.
  useEffect(() => {
    if (fabrics.length === 0) return;
    if (currentGalleryIndex === undefined || currentGalleryIndex === null) return;
    const oneBased = currentGalleryIndex + 1;
    const match = fabrics.find(
      (f) => isFabricCategory(f) && Array.isArray(f.image_indices) && f.image_indices.includes(oneBased),
    );
    if (!match) return;
    if (selectedFabricId === match.id) return;
    setSelectedFabricId(match.id);
    onUpholsteryTierChange?.(match.price_tier_label ?? null);
    onFabricChange?.({
      id: match.id,
      name: match.name,
      tier: match.tier ?? null,
      price_per_lm_cents: match.price_per_lm_cents ?? null,
      currency: match.currency || "EUR",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabrics, currentGalleryIndex]);


  const renderTile = (f: Fabric, kindOverride?: "fabric" | "cover" | "base" | "top") => {
    const isCom = f.id === "__com__";
    const isCol = f.id === "__col__";
    const isFabricGroup = kindOverride ? kindOverride === "fabric" : isFabricCategory(f);
    const isCoverGroup = kindOverride ? kindOverride === "cover" : isCoverCategory(f);
    const isTopGroup = kindOverride === "top";
    const isSelected = isFabricGroup
      ? selectedFabricId === f.id
      : isCoverGroup
      ? selectedCoverId === f.id
      : isTopGroup
      ? selectedTopId === f.id
      : selectedWoodId === f.id;
    const setSelected = isFabricGroup
      ? setSelectedFabricId
      : isCoverGroup
      ? setSelectedCoverId
      : isTopGroup
      ? setSelectedTopId
      : setSelectedWoodId;

    const handlePick = () => {
      setSelected(f.id);
      const indices = Array.isArray(f.image_indices) && f.image_indices.length > 0 ? f.image_indices : null;
      // Only fabric/leather drives the upholstery price tier. Wood finishes
      // are decorative and don't change the variant matrix on this product.
      if (isFabricGroup) {
        onUpholsteryTierChange?.(f.price_tier_label ?? null);
        // Emit pricing details so the product page can add the per-LM upcharge
        // to the displayed total. COM/COL tiles have no per-LM price.
        if (isCom || isCol) {
          onFabricChange?.(null);
        } else {
          onFabricChange?.({
            id: f.id,
            name: f.name,
            tier: f.tier ?? null,
            price_per_lm_cents: f.price_per_lm_cents ?? null,
            currency: f.currency || "EUR",
          });
        }
      } else if (isCoverGroup) {
        // Cover (rattan/cane/wicker) is purely decorative — only update the
        // hero image; do not drive the Frame variant matrix or pricing.
      } else if (isTopGroup) {
        // Top-axis finish (e.g. diffuser on a pendant) — drive the Top axis.
        onTopFinishChange?.(f.name);
      } else {
        // Wood finish picked — drive the Frame axis on the price matrix.
        onWoodFinishChange?.(f.name);
        // Emit frame-price override so the product page can use it as the
        // RRP base (fabric per-LM upcharge is added on top).
        if (f.frame_price_cents && f.frame_price_cents > 0) {
          onWoodFinishPricingChange?.({
            id: f.id,
            name: f.name,
            price_cents: f.frame_price_cents,
            currency: f.frame_price_currency || "EUR",
            image_url: f.image_url ?? null,
          });
        } else {
          onWoodFinishPricingChange?.(null);
        }
      }

      // Notify product page of mapped gallery images LAST so the swatch's
      // image jump wins over any gallery reset triggered by the tier/variant
      // sync above (e.g. handleMaterialChange's partial-pair fallback to
      // index 0). Defer to the next tick to outrun the state updates queued
      // by the upstream handlers.
      if (indices) {
        setTimeout(() => onSwatchImagesChange?.(indices), 0);
      } else {
        onSwatchImagesChange?.(null);
      }
    };

    const tierCaption = isFabricGroup && !isCom && !isCol && (f.tier || f.price_per_lm_cents)
      ? [
          f.tier ? `CAT ${f.tier}` : null,
          f.price_per_lm_cents ? `€${(f.price_per_lm_cents / 100).toLocaleString()}/LM` : null,
        ].filter(Boolean).join(" · ")
      : null;
    const noImages = !f.image_indices || f.image_indices.length === 0;
    const hoverPreview = () => {
      if (isMobile) return;
      const indices = Array.isArray(f.image_indices) && f.image_indices.length > 0 ? f.image_indices : null;
      if (indices) onSwatchImagesChange?.(indices);
    };
    const tileButton = (
      <button
        type="button"
        onClick={handlePick}
        onMouseEnter={hoverPreview}
        onFocus={hoverPreview}
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-md bg-muted/30 ring-1 ring-border/60 transition",
          isSelected ? "ring-2 ring-foreground" : "hover:ring-foreground/40"
        )}
        aria-label={`Select ${f.name}`}

      >
        {f.image_url ? (
          <img
            src={f.image_url}
            alt={f.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={cn("w-full h-full flex items-center justify-center font-display text-xl tracking-widest text-foreground/85", noImages && "opacity-60")}>
            {isCom ? "COM" : isCol ? "COL" : "—"}
          </div>
        )}
        {f.image_url && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(f);
            }}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground/70 hover:text-foreground"
            aria-label={`Zoom ${f.name}`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </span>
        )}
        {noImages && (
          <span className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground/70">
            <ImageOff className="w-3 h-3" />
          </span>
        )}
      </button>
    );
    return (
      <div key={f.id} className="flex flex-col gap-2">
        {noImages ? (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              {tileButton}
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              No image for this finish
            </TooltipContent>
          </Tooltip>
        ) : (
          tileButton
        )}
        <p className="font-body text-[12px] leading-snug text-foreground/85">
          {f.supplier ? (
            <>
              <span className="font-medium">{f.supplier}</span>
              <span className="text-foreground/60"> — {f.name}</span>
            </>
          ) : (
            f.name
          )}
        </p>
        {tierCaption && (
          <p className="font-body text-[10px] tracking-wider uppercase text-muted-foreground -mt-1">
            {tierCaption}
          </p>
        )}
      </div>
    );
  };

  const [openWood, setOpenWood] = useState(false);
  const [openTop, setOpenTop] = useState(false);
  const [openCover, setOpenCover] = useState(false);
  const isMobile = useIsMobile();
  const fabricTiles = isRugProduct
    ? (grouped["Rug Finish"] || grouped["Fabric & Leather"] || [])
    : (grouped["Fabric & Leather"] || []);
  const allNonFabricTiles = sortedGroupKeys
    .filter((key) => key !== "Fabric & Leather" && key !== "Rug Finish" && key !== "Cover")
    .flatMap((key) => grouped[key] || []);
  // Top-axis swatches first (e.g. diffuser), then base-axis swatches with the
  // top swatches excluded so a single physical swatch doesn't appear in both
  // groups when the filters overlap.
  const topTiles = topFilter ? allNonFabricTiles.filter((f) => topFilter(f.name)) : [];
  const topTileIds = new Set(topTiles.map((t) => t.id));
  const woodTiles = allNonFabricTiles
    .filter((f) => !topTileIds.has(f.id))
    .filter((f) => !woodFilter || woodFilter(f.name));
  const coverTiles = grouped["Cover"] || [];

  // Show all linked finishes on every breakpoint — swatches without mapped
  // gallery images still render (with the ImageOff badge) so users can pick
  // them and request samples through the concierge.
  const visibleFabricTiles = fabricTiles;
  const visibleWoodTiles   = woodTiles;
  const visibleTopTiles    = topTiles;
  const visibleCoverTiles  = coverTiles;


  const renderAccordion = (args: {
    isOpen: boolean;
    onToggle: () => void;
    label: string;
    selectedName: string | null;
    tiles: Fabric[];
    emptyNote?: string;
    glyph: string;
    tileKind?: "fabric" | "cover" | "base" | "top";
  }) => (
    <div className="border-t border-border/60">
      <button
        type="button"
        onClick={args.onToggle}
        aria-expanded={args.isOpen}
        className="w-full py-4 flex items-center gap-5 text-left border-b border-border/60"
      >
        <span className="shrink-0">
          <SpecGlyph symbol={args.glyph} />
        </span>
        <span className="font-body text-sm tracking-wide text-muted-foreground flex-1">
          {args.label}
        </span>
        {args.selectedName && (
          <span className="font-body text-sm text-foreground/85 truncate max-w-[55%] text-right">
            {args.selectedName}
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform shrink-0",
            args.isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      {args.isOpen && (
        <div className="pb-5 pt-4">
          {args.tiles.length > 0 ? (
            <div className="grid grid-cols-5 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
              {args.tiles.map((f) => renderTile(f, args.tileKind))}
            </div>
          ) : (
            args.emptyNote && (
              <p className="font-body text-[12px] italic text-muted-foreground">
                {args.emptyNote}
              </p>
            )
          )}
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <div className={className}>
      {(showUpholsterySection || fabrics.some(isFabricCategory)) && renderAccordion({
        isOpen: open,
        onToggle: () => setOpen((v) => !v),
        label: isRugProduct
          ? "Select Your Rug Finish"
          : "Select Your Fabric / Leather",
        selectedName: selectedFabricItem?.name ?? null,
        tiles: visibleFabricTiles,
        glyph: "fabric",
        emptyNote:
          "Full fabric library coming soon. In the meantime, your atelier can be upholstered in COM (Customer's Own Fabric) — please request samples or pricing through your Maison Affluency concierge.",
      })}
      {showWoodSection && visibleWoodTiles.length > 0 &&
        renderAccordion({
          isOpen: openWood,
          onToggle: () => setOpenWood((v) => !v),
          label: (() => {
            if (woodLabel && woodLabel.trim()) return woodLabel.trim();
            const isTable = !!productTitle && /\btable\b/i.test(productTitle);
            // Tables typically share a single marble/stone palette across the
            // top AND the base — collapse the two pickers into one unified
            // "Top & Base" label so the user sees one selection control.
            const cats = visibleWoodTiles.map((t) => (t.category || "").trim().toLowerCase());
            const allStone = cats.length > 0 && cats.every((c) => c === "stone");
            const noSeparateTop = visibleTopTiles.length === 0;
            if (isTable && allStone && noSeparateTop) {
              return "Select Your Marble Finish (Top & Base)";
            }
            if (isTable) return "Select Your Table Finish";
            return "Select Your Finish";

          })(),
          selectedName: selectedWoodItem?.name ?? null,
          tiles: visibleWoodTiles,
          glyph: pickFinishGlyph(visibleWoodTiles, woodLabel),
          tileKind: "base",
        })}
      {showWoodSection && visibleTopTiles.length > 0 &&
        renderAccordion({
          isOpen: openTop,
          onToggle: () => setOpenTop((v) => !v),
          label: (topLabel && topLabel.trim()) || "Select the Finish",
          selectedName: selectedTopItem?.name ?? null,
          tiles: visibleTopTiles,
          glyph: pickFinishGlyph(visibleTopTiles, topLabel),
          tileKind: "top",
        })}
      {visibleCoverTiles.length > 0 &&
        renderAccordion({
          isOpen: openCover,
          onToggle: () => setOpenCover((v) => !v),
          label: "Select the Finish of the Cover",
          selectedName: selectedCoverItem?.name ?? null,
          tiles: visibleCoverTiles,
          glyph: "fabric",
        })}


      {zoomed && (
        <div
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-background rounded-lg shadow-xl w-full max-w-[560px] max-h-[92vh] flex flex-col"
          >
            {/* Header with title + confirm */}
            <div className="flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-border/60">
              <div className="min-w-0">
                {productTitle && (
                  <p className="font-display text-base sm:text-lg text-foreground leading-tight truncate">
                    {productTitle}
                  </p>
                )}
                <p className="font-body text-xs text-muted-foreground mt-0.5 truncate">
                  {zoomed.supplier ? `${zoomed.supplier} — ` : ""}
                  {zoomed.name}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const isFabric = isFabricCategory(zoomed);
                    const indices = Array.isArray(zoomed.image_indices) && zoomed.image_indices.length > 0 ? zoomed.image_indices : null;
                    if (indices) {
                      setTimeout(() => onSwatchImagesChange?.(indices), 0);
                    } else {
                      onSwatchImagesChange?.(null);
                    }
                    if (isFabric) {
                      setSelectedFabricId(zoomed.id);
                      onUpholsteryTierChange?.(zoomed.price_tier_label ?? null);
                      const isCom = zoomed.id === "__com__";
                      const isCol = zoomed.id === "__col__";
                      if (isCom || isCol) {
                        onFabricChange?.(null);
                      } else {
                        onFabricChange?.({
                          id: zoomed.id,
                          name: zoomed.name,
                          tier: zoomed.tier ?? null,
                          price_per_lm_cents: zoomed.price_per_lm_cents ?? null,
                          currency: zoomed.currency || "EUR",
                        });
                      }
                    } else if (isCoverCategory(zoomed)) {
                      setSelectedCoverId(zoomed.id);
                    } else {
                      setSelectedWoodId(zoomed.id);

                      onWoodFinishChange?.(zoomed.name);
                      if (zoomed.frame_price_cents && zoomed.frame_price_cents > 0) {
                        onWoodFinishPricingChange?.({
                          id: zoomed.id,
                          name: zoomed.name,
                          price_cents: zoomed.frame_price_cents,
                          currency: zoomed.frame_price_currency || "EUR",
                          image_url: zoomed.image_url ?? null,
                        });
                      } else {
                        onWoodFinishPricingChange?.(null);
                      }
                    }
                    setZoomed(null);
                  }}
                  className="px-4 py-2 bg-foreground text-background font-body text-[11px] tracking-[0.18em] uppercase hover:bg-foreground/90 transition"
                >
                  Confirm choice
                </button>
                <button
                  type="button"
                  onClick={() => setZoomed(null)}
                  aria-label="Close"
                  className="w-9 h-9 rounded-full bg-background ring-1 ring-border flex items-center justify-center text-foreground/80 hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto">
              {zoomed.image_url ? (
                <img
                  src={zoomed.image_url}
                  alt={zoomed.name}
                  className="w-full h-auto rounded-md aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square rounded-md bg-muted/40 flex items-center justify-center font-display text-4xl tracking-widest text-foreground/80">
                  {zoomed.id === "__com__" ? "COM" : "—"}
                </div>
              )}

              {(() => {
                const zoomedIsFabric = isFabricCategory(zoomed);
                const zoomedIsCover = isCoverCategory(zoomed);
                const thumbs = zoomedIsFabric ? fabricTiles : zoomedIsCover ? coverTiles : woodTiles;
                const stripLabel = zoomedIsFabric
                  ? "Select fabric & leather"
                  : zoomedIsCover
                  ? "Select the finish of the cover"
                  : "Select the wood finish of the frame";
                return (
                  <div className="mt-5 pt-5 border-t border-border/60">
                    <p className="font-body text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-3">
                      {stripLabel}
                    </p>

                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                      {thumbs.map((f) => {
                        const isActive = zoomed.id === f.id;
                        const isCom = f.id === "__com__";
                        const isCol = f.id === "__col__";
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setZoomed(f)}
                            className={cn(
                              "shrink-0 w-16 h-16 rounded-md overflow-hidden bg-muted/30 ring-1 transition",
                              isActive
                                ? "ring-2 ring-foreground"
                                : "ring-border/60 hover:ring-foreground/40"
                            )}
                            aria-label={`View ${f.name}`}
                            title={f.name}
                          >
                            {f.image_url ? (
                              <img
                                src={f.image_url}
                                alt={f.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-display text-[11px] tracking-widest text-foreground/80">
                                {isCom ? "COM" : isCol ? "COL" : "—"}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
