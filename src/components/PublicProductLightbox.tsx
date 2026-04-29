import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Layers, Ruler, FileDown, Heart, Scale, ArrowRight } from "lucide-react";
import LightboxDescriptionDropdown from "@/components/ui/LightboxDescriptionDropdown";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import SpecSheetButton, { type PdfEntry } from "@/components/trade/SpecSheetButton";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthGateDialog from "@/components/AuthGateDialog";
import ExpandableSpec from "@/components/ExpandableSpec";
import { getBasePlaceholder, getTopPlaceholder } from "@/lib/variantPlaceholders";
import { formatDimensionsMultiline } from "@/lib/formatDimensions";
import { useDesignerByName } from "@/hooks/useDesigner";
import { buildProductFinishMap, resolveFinishImageIndex, resolveVariantImageIndex } from "@/lib/variantImageMap";

/** Mirrors the slugifier used by FeaturedDesigners + PublicProductPage. */
const slugifyProduct = (s: string) =>
  s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export interface PublicLightboxItem {
  id: string;
  title: string;
  subtitle?: string | null;
  image_url: string;
  hover_image_url?: string | null;
  brand_name: string;
  materials?: string | null;
  dimensions?: string | null;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  pdf_url?: string | null;
  pdf_urls?: PdfEntry[] | null;
  size_variants?: { label?: string; base?: string; top?: string; price_cents?: number }[] | null;
  variant_placeholder?: string | null;
  base_axis_label?: string | null;
  top_axis_label?: string | null;
  /** Full product gallery; used together with variant_image_map to swap the lightbox image when a finish is picked. */
  gallery_images?: string[] | null;
  /** Maps normalized finish labels → gallery_images index. */
  variant_image_map?: Record<string, number> | null;
}

interface Props {
  product: PublicLightboxItem | null;
  allPicks?: PublicLightboxItem[];
  onClose: () => void;
  onSelectRelated?: (item: PublicLightboxItem) => void;
  /** When true, render inline instead of portaling to document.body */
  inline?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Tiny localStorage-backed favorites (no auth needed)                */
/* ------------------------------------------------------------------ */
const LS_KEY = "public_favorites";

function readLocalFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function writeLocalFavorites(ids: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new Event("public_favorites_changed"));
}

function useLocalFavorites() {
  const [ids, setIds] = useState<Set<string>>(() => readLocalFavorites());
  const hasShownPromptRef = useRef(false);

  const isFavorited = useCallback((id: string) => ids.has(id), [ids]);

  const toggleFavorite = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      const wasAdding = !next.has(id);
      if (next.has(id)) next.delete(id); else next.add(id);
      writeLocalFavorites(next);

      // After 3+ favourites, prompt to register so they persist
      if (wasAdding && next.size >= 3 && !hasShownPromptRef.current) {
        hasShownPromptRef.current = true;
        import("sonner").then(({ toast }) =>
          toast("Save your favourites permanently", {
            description: "Create a free account so your favourites sync across devices.",
            action: {
              label: "Sign up",
              onClick: () => window.location.assign("/trade-program"),
            },
            duration: 8000,
          })
        );
      }

      return next;
    });
  }, []);

  return { isFavorited, toggleFavorite };
}

/* ------------------------------------------------------------------ */

const PublicProductLightbox = ({ product, allPicks = [], onClose, onSelectRelated, inline }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { requireAuth, gateOpen, gateAction, closeGate } = useAuthGate();
  const { isFavorited, toggleFavorite } = useLocalFavorites();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [showHoverImage, setShowHoverImage] = useState(false);
  const [hoverImageLoaded, setHoverImageLoaded] = useState(false);

  // Resolve canonical designer slug (same hook used by product pages)
  const designerDisplayName = product
    ? (product.brand_name.includes(" - ")
        ? product.brand_name.split(" - ")[0].trim()
        : product.brand_name)
    : undefined;
  const { data: linkedDesigner } = useDesignerByName(designerDisplayName);

  // Reset per-product state when the product changes (incl. selected finish).
  const [selectedBaseIdx, setSelectedBaseIdx] = useState<number | null>(null);
  const [selectedTopIdx, setSelectedTopIdx] = useState<number | null>(null);
  const [selectedMaterialIdx, setSelectedMaterialIdx] = useState<number | null>(null);

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setHoverImageLoaded(false);
    setShowHoverImage(false);
    setSelectedBaseIdx(null);
    setSelectedTopIdx(null);
    setSelectedMaterialIdx(null);
  }, [product?.id]);

  // Track whether body overflow was already hidden (e.g. by a parent Gallery lightbox)
  // so we don't clobber it on close.
  useEffect(() => {
    if (!product) return;
    const wasAlreadyHidden = document.body.style.overflow === "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (!wasAlreadyHidden) document.body.style.overflow = "";
    };
  }, [product]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const candidates = allPicks.filter((p) => p.id !== product.id && p.image_url);
    // Vary selection per product using a simple hash offset
    const hash = product.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const offset = hash % Math.max(candidates.length, 1);
    const picked: PublicLightboxItem[] = [];
    for (let i = 0; i < Math.min(4, candidates.length); i++) {
      picked.push(candidates[(offset + i) % candidates.length]);
    }
    return picked;
  }, [product?.id, allPicks]);

  if (!product) return null;

  const canShowHoverImage = Boolean(product.hover_image_url) && !isMobile;
  const designerDisplay = product.brand_name.includes(" - ")
    ? product.brand_name.split(" - ")[0].trim()
    : product.brand_name;
  const favorited = isFavorited(product.id);

  /* ── Finish-driven image swap ───────────────────────────────────────── */
  const finishMap = buildProductFinishMap(product.variant_image_map);
  const galleryImages = (product.gallery_images || []).filter(Boolean);
  const sv = product.size_variants || [];
  const isDualAxis = sv.length > 0 && sv.some((v) => (v.base && v.base.trim()) || (v.top && v.top.trim()));
  const baseOptions = isDualAxis
    ? Array.from(new Set(sv.map((v) => (v.base || "").trim()).filter(Boolean)))
    : [];
  const topOptionsForResolve = isDualAxis
    ? Array.from(new Set(sv.map((v) => (v.top || "").trim()).filter(Boolean)))
    : [];
  const materialOptions = !isDualAxis && product.materials ? product.materials.split("\n").map((s) => s.trim()).filter(Boolean) : [];
  // Resolve which gallery image matches the current selection. For dual-axis
  // products we first try the composite Base|Top key (so rows that share the
  // same Top — e.g. Apparatus Lantern Table Lamp where every row is "Slip-cast
  // Porcelain" but Structure differs — still get distinct images), then fall
  // back to single-axis labels.
  let finishImageIdx: number | undefined;
  if (finishMap && galleryImages.length > 0) {
    if (isDualAxis) {
      const topLabel =
        selectedTopIdx != null && selectedTopIdx >= 0 ? topOptionsForResolve[selectedTopIdx] : null;
      const baseLabel =
        selectedBaseIdx != null && selectedBaseIdx >= 0 ? baseOptions[selectedBaseIdx] : null;
      finishImageIdx = resolveVariantImageIndex(finishMap, {
        base: baseLabel,
        top: topLabel,
        imageCount: galleryImages.length,
      });
    } else if (selectedMaterialIdx != null && selectedMaterialIdx >= 0) {
      const v = materialOptions[selectedMaterialIdx];
      if (v) finishImageIdx = resolveFinishImageIndex(finishMap, v, galleryImages.length);
    }
  }
  const currentImageUrl = finishImageIdx != null ? galleryImages[finishImageIdx] : product.image_url;
  const imageSwappedByFinish = currentImageUrl !== product.image_url;

  /* ── Linked product page URL (only when designer slug resolves) ───── */
  const productPageHref = linkedDesigner?.slug
    ? `/designers/${linkedDesigner.slug}/${slugifyProduct(product.title + (product.subtitle ? `-${product.subtitle}` : ""))}`
    : null;

  const compareItem: CompareItem = {
    pick: {
      title: product.title,
      subtitle: product.subtitle || undefined,
      image: product.image_url,
      hoverImage: product.hover_image_url || undefined,
      materials: product.materials,
      dimensions: product.dimensions,
      category: product.category || undefined,
      subcategory: product.subcategory || undefined,
    },
    designerName: designerDisplay,
    designerId: product.id,
    section: "designers",
  };

  const pinned = isPinned(product.title, product.id);

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
          className="relative max-w-4xl w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:flex-row bg-background/85 backdrop-blur-xl md:rounded-xl rounded-none shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile header */}
          <div className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 pt-3 pb-2 bg-background/90 backdrop-blur-sm border-b border-border/60 shrink-0">
            <div className="w-8" />
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            <button onClick={onClose} className="p-2 rounded-full bg-foreground/15 text-foreground hover:bg-foreground/25 transition-all" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Desktop close */}
          <button onClick={onClose} className="hidden md:flex absolute top-3 right-3 z-20 p-2 rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-all" aria-label="Close">
            <X size={18} />
          </button>

          {/* Scrollable mobile body */}
          <div className="flex-1 overflow-y-auto md:flex md:flex-row md:overflow-visible">

          {/* Image */}
          <div
            className="relative w-full md:w-1/2 h-[55vh] md:h-auto shrink-0 bg-muted/30 flex items-center justify-center p-2 md:p-0 md:min-h-[400px]"
            onMouseEnter={() => { if (canShowHoverImage) setShowHoverImage(true); }}
            onMouseLeave={() => setShowHoverImage(false)}
          >
            {product.image_url ? (
              <>
                {!imageLoaded && !imageFailed && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-lg bg-muted animate-pulse" />
                  </div>
                )}
                {imageFailed && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-body text-sm text-muted-foreground">Image unavailable</span>
                  </div>
                )}
                <img
                  key={currentImageUrl /* re-mount on finish swap so loader resets */}
                  src={currentImageUrl}
                  alt={product.title}
                  onLoad={() => { setImageLoaded(true); setImageFailed(false); }}
                  onError={() => { setImageFailed(true); setImageLoaded(true); }}
                  className={cn(
                    "w-full h-full object-contain transition-opacity duration-300",
                    imageFailed ? "opacity-0"
                      : !imageLoaded ? "opacity-0"
                        : showHoverImage && canShowHoverImage && hoverImageLoaded && !imageSwappedByFinish ? "opacity-0"
                          : "opacity-100"
                  )}
                  style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
                />
                {canShowHoverImage && product.hover_image_url && !imageSwappedByFinish && (
                  <img
                    src={product.hover_image_url}
                    alt={`${product.title} in context`}
                    onLoad={() => setHoverImageLoaded(true)}
                    onError={() => setHoverImageLoaded(false)}
                    className={cn(
                      "absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-300",
                      showHoverImage && hoverImageLoaded ? "opacity-100" : "opacity-0"
                    )}
                  />
                )}
              </>
            ) : (
              <span className="font-body text-sm text-muted-foreground">No image</span>
            )}

            {/* Description overlay on image — mirrors Trade lightbox */}
            <div className="absolute top-3 right-3 z-20">
              <LightboxDescriptionDropdown description={product.description} />
            </div>

            {/* Mobile: secondary action icons */}
            <div className="md:hidden absolute bottom-3 left-3 z-10 flex gap-3.5">
              <button
                onClick={() => toggleFavorite(product.id)}
                title={favorited ? "Favorited" : "Favorite"}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-md transition-all shadow-md",
                  favorited
                    ? "bg-destructive/80 text-white"
                    : "bg-background/70 text-muted-foreground hover:text-foreground"
                )}
              >
                <Heart size={15} className={cn(favorited && "fill-current")} />
              </button>

              <button
                onClick={() => togglePin(compareItem)}
                title={pinned ? "Pinned" : "Pin to Selection"}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-md transition-all shadow-md",
                  pinned
                    ? "bg-[hsl(var(--gold))]/80 text-white"
                    : "bg-background/70 text-muted-foreground hover:text-foreground",
                  compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                )}
              >
                <Scale size={15} />
              </button>

              {(product.pdf_url || (product.pdf_urls && product.pdf_urls.length > 0)) && (
                <SpecSheetButton
                  pdfUrl={product.pdf_url}
                  pdfUrls={product.pdf_urls}
                  brandName={designerDisplay}
                  productName={product.title}
                  variant="icon"
                  onBeforeOpen={() => { let allowed = false; requireAuth(() => { allowed = true; }, "download this spec sheet"); return allowed; }}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-[hsl(var(--pdf-red))] backdrop-blur-md text-white transition-all shadow-md cursor-pointer"
                />
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 p-5 md:p-8 flex flex-col gap-3 md:gap-4 overflow-y-auto">
            <div>
              <button
                type="button"
                onClick={() => {
                  if (!linkedDesigner?.slug) return;
                  onClose();
                  navigate(
                    `/designers/${linkedDesigner.slug}?from_product=${encodeURIComponent(location.pathname + location.search)}`
                  );
                }}
                disabled={!linkedDesigner?.slug}
                className="font-body text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--gold))] hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer text-left"
              >
                {designerDisplay}
              </button>
              <h2 className="font-display text-lg md:text-2xl text-foreground mt-1 leading-tight">
                {product.subtitle
                  ? `${product.title} ${product.subtitle}`
                  : product.title}
              </h2>
            </div>

            <div className="flex flex-col">
              {(() => {
                if (isDualAxis) {
                  const topOptions = Array.from(new Set(sv.map((v) => (v.top || "").trim()).filter(Boolean)));
                  return (
                    <>
                      <ExpandableSpec
                        icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                        text={baseOptions.join("\n")}
                        placeholder={getBasePlaceholder(product)}
                        emphasized
                        value={selectedBaseIdx ?? undefined}
                        onChange={(idx) => setSelectedBaseIdx(idx < 0 ? null : idx)}
                      />
                      <ExpandableSpec
                        icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                        text={topOptions.join("\n")}
                        placeholder={getTopPlaceholder(product)}
                        emphasized
                        value={selectedTopIdx ?? undefined}
                        onChange={(idx) => setSelectedTopIdx(idx < 0 ? null : idx)}
                      />
                    </>
                  );
                }
                return product.materials ? (
                  <ExpandableSpec
                    icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                    text={product.materials}
                    placeholder="Select your material choice"
                    autoSplit
                    value={selectedMaterialIdx ?? undefined}
                    onChange={(idx) => setSelectedMaterialIdx(idx < 0 ? null : idx)}
                  />
                ) : null;
              })()}
              {(() => {
                const sv = product.size_variants || [];
                const isDualAxis = sv.length > 0 && sv.some((v) => (v.base && v.base.trim()) || (v.top && v.top.trim()));
                const dualSizeOptions = isDualAxis
                  ? Array.from(new Set(sv.map((v) => (v.label || "").trim()).filter(Boolean)))
                  : [];
                if (isDualAxis && dualSizeOptions.length > 0) {
                  return (
                    <ExpandableSpec
                      icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                      text={dualSizeOptions.join("\n")}
                      emphasized
                      placeholder="Select your size"
                    />
                  );
                }
                // Single-axis variants (label + price only) — surface labels as size dropdown.
                if (!isDualAxis && sv.length > 1) {
                  const labels = Array.from(
                    new Set(sv.map((v) => (v.label || "").trim()).filter(Boolean))
                  );
                  if (labels.length > 1) {
                    return (
                      <ExpandableSpec
                        icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                        text={labels.join("\n")}
                        emphasized
                        placeholder="Select your size"
                      />
                    );
                  }
                }
                return product.dimensions ? (
                  <ExpandableSpec
                    icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                    text={formatDimensionsMultiline(product.dimensions)}
                    emphasized
                    placeholder="Select your size"
                  />
                ) : null;
              })()}
            </div>


            {/* Primary CTA — visit the full product page (more images, full spec, gallery) */}
            <div className="mt-auto pt-3 md:pt-4 flex flex-col gap-2">
              {productPageHref ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(productPageHref, {
                      state: { from: location.pathname + location.search },
                    });
                  }}
                  className="group flex items-center justify-center gap-2 px-5 py-3 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all w-full bg-foreground text-background hover:bg-foreground/90"
                >
                  View full product page
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <a
                  href="/trade-program"
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all w-full bg-foreground text-background hover:bg-foreground/90"
                >
                  Price on Request
                </a>
              )}
              {productPageHref && (
                <p className="text-center font-body text-[10px] tracking-wide text-muted-foreground/80">
                  See all photos, finishes & specifications
                </p>
              )}
            </div>

            {/* Desktop secondary actions */}
            <div className="hidden md:grid grid-cols-3 gap-2">
              <button
                onClick={() => toggleFavorite(product.id)}
                title={favorited ? "Favorited" : "Favorite"}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border",
                  favorited
                    ? "border-destructive/30 text-destructive bg-destructive/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                <Heart size={13} className={cn(favorited && "fill-current")} />
                {favorited ? "Favorited" : "Favorite"}
              </button>

              <button
                onClick={() => togglePin(compareItem)}
                title={pinned ? "Pinned" : "Pin to Selection"}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border",
                  pinned
                    ? "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-[hsl(var(--gold))]"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                )}
              >
                <Scale size={13} />
                {pinned ? "Pinned" : "Pin to Selection"}
              </button>

              {(product.pdf_url || (product.pdf_urls && product.pdf_urls.length > 0)) && (
                <SpecSheetButton
                  pdfUrl={product.pdf_url}
                  pdfUrls={product.pdf_urls}
                  brandName={designerDisplay}
                  productName={product.title}
                  variant="button"
                  onBeforeOpen={() => { let allowed = false; requireAuth(() => { allowed = true; }, "download this spec sheet"); return allowed; }}
                />
              )}
            </div>

            {/* More from this designer */}
            {relatedProducts.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">
                  More from {designerDisplay}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                  {relatedProducts.map((rp) => (
                    <button
                      key={rp.id}
                      onClick={() => onSelectRelated?.(rp)}
                      className="shrink-0 w-20 group"
                    >
                      <div className="aspect-square rounded-md overflow-hidden bg-muted/30 border border-border group-hover:border-foreground/30 transition-colors">
                        <img
                          src={rp.image_url}
                          alt={rp.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <p className="font-body text-[9px] text-muted-foreground mt-1 truncate group-hover:text-foreground transition-colors">
                        {rp.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-border">
              <p className="font-body text-[11px] text-muted-foreground">
                For pricing and availability, please{" "}
                <a href="/trade-program" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  join our Trade Program
                </a>.
              </p>
            </div>
          </div>
          </div> {/* end scrollable mobile body */}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <>
      {inline ? content : createPortal(content, document.body)}
      <AuthGateDialog open={gateOpen} onClose={closeGate} action={gateAction} />
    </>
  );
};

export default PublicProductLightbox;
