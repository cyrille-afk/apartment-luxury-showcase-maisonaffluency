import { useEffect, useState } from "react";
import { ChevronDown, ZoomIn, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import SpecGlyph from "@/components/product/SpecGlyph";

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

export interface SelectedFabricInfo {
  id: string;
  name: string;
  tier: string | null;
  price_per_lm_cents: number | null;
  currency: string;
}

interface FabricSelectorProps {
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
  onFabricChange?: (fabric: SelectedFabricInfo | null) => void;
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
}

const normalizeFabricCategory = (category: string | null | undefined) => {
  const raw = (category || "").trim();
  if (raw === "Wood") return "Wood";
  if (raw === "Upholstery" || raw === "Leather" || raw === "Fabric & Leather") return "Fabric & Leather";
  return "Fabric & Leather";
};

const isFabricCategory = (fabric: Fabric) => normalizeFabricCategory(fabric.category) === "Fabric & Leather";

/**
 * Fabric / finish selector accordion shown on upholstered products
 * (Trade + Public). Tiles are grouped by category (Upholstery, Wood, …)
 * with a COM ("Customer's Own Material") tile always offered.
 */
export default function FabricSelector({ pickId, className, productTitle, onUpholsteryTierChange, onFabricChange, onHasFabricsChange, onWoodFinishChange, onWoodFinishPricingChange, onWoodFinishesAvailable, includePricing = false, onSwatchImagesChange }: FabricSelectorProps) {

  const [open, setOpen] = useState(false);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null);
  const [selectedWoodId, setSelectedWoodId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<Fabric | null>(null);

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
      onWoodFinishesAvailable?.(list.filter((f) => !isFabricCategory(f)).map((f) => f.name));
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
  const groupOrder = ["Fabric & Leather", "Wood"];
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
  // their "own material" options alongside the curated swatches.
  if (grouped["Fabric & Leather"]) {
    grouped["Fabric & Leather"] = [...grouped["Fabric & Leather"], comTile, colTile];
  } else {
    grouped["Fabric & Leather"] = [comTile, colTile];
    if (!sortedGroupKeys.includes("Fabric & Leather")) sortedGroupKeys.unshift("Fabric & Leather");
  }

  const selectedFabricItem =
    selectedFabricId === "__com__"
      ? comTile
      : selectedFabricId === "__col__"
      ? colTile
      : fabrics.find((f) => f.id === selectedFabricId) || null;
  const selectedWoodItem = fabrics.find((f) => f.id === selectedWoodId) || null;

  const renderTile = (f: Fabric) => {
    const isCom = f.id === "__com__";
    const isCol = f.id === "__col__";
    const isFabricGroup = isFabricCategory(f);
    const isSelected = isFabricGroup
      ? selectedFabricId === f.id
      : selectedWoodId === f.id;
    const setSelected = isFabricGroup ? setSelectedFabricId : setSelectedWoodId;
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
    return (
      <div key={f.id} className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handlePick}
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
            <div className="w-full h-full flex items-center justify-center font-display text-xl tracking-widest text-foreground/85">
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
        </button>
        <p className="font-body text-[12px] leading-snug text-foreground/85">
          {f.name}
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
  const fabricTiles = grouped["Fabric & Leather"] || [];
  const woodTiles = grouped["Wood"] || [];

  const renderAccordion = (args: {
    isOpen: boolean;
    onToggle: () => void;
    label: string;
    selectedName: string | null;
    tiles: Fabric[];
    emptyNote?: string;
    glyph: string;
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              {args.tiles.map(renderTile)}
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
    <div className={className}>
      {renderAccordion({
        isOpen: open,
        onToggle: () => setOpen((v) => !v),
        label: "Select Your Fabric / Leather",
        selectedName: selectedFabricItem?.name ?? null,
        tiles: fabricTiles,
        glyph: "fabric",
        emptyNote:
          "Full fabric library coming soon. In the meantime, your atelier can be upholstered in COM (Customer's Own Fabric) — please request samples or pricing through your Maison Affluency concierge.",
      })}
      {woodTiles.length > 0 &&
        renderAccordion({
          isOpen: openWood,
          onToggle: () => setOpenWood((v) => !v),
          label: "Select the Wood Finish of the Frame",
          selectedName: selectedWoodItem?.name ?? null,
          tiles: woodTiles,
          glyph: "wood",
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
                const thumbs = zoomedIsFabric ? fabricTiles : woodTiles;
                return (
                  <div className="mt-5 pt-5 border-t border-border/60">
                    <p className="font-body text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-3">
                      {zoomedIsFabric ? "Select fabric & leather" : "Select the wood finish of the frame"}
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
  );
}
