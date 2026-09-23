import { useState, useMemo } from "react";
import { CldPicture } from "@/components/ui/CldPicture";
import { Link, useNavigate } from "react-router-dom";
import { motion, type Transition } from "framer-motion";
import { ArrowRight, FileText, Maximize2, Instagram } from "lucide-react";
import ProductCardDescriptionOverlay from "@/components/ui/ProductCardDescriptionOverlay";
import { InventoryBadgeStack } from "@/components/ui/InventoryBadge";
import ShareMenu from "@/components/ShareMenu";
import PublicProductLightbox, { type PublicLightboxItem } from "@/components/PublicProductLightbox";
import type { Designer, DesignerCuratorPick } from "@/hooks/useDesigner";
import { useDesignerPicks, useGroupedDesignerPicks, useAllDesigners } from "@/hooks/useDesigner";
import { useDesignerInstagramPosts } from "@/hooks/useDesignerInstagramPosts";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import SpecSheetButton from "@/components/trade/SpecSheetButton";
import { buildDesignerOgUrl } from "@/lib/whatsapp-share";
import { isParentBrandDesigner } from "@/lib/designerHierarchy";
import { useFounderIsBrand } from "@/hooks/useFounderIsBrand";
import { cn } from "@/lib/utils";
import { renderParagraph } from "@/components/EditorialBiography";
import { composeTitle, splitTitleAttribution } from "@/lib/curatorPickLegend";
import { isFinishSubtitle } from "@/lib/subtitleDisplay";
import { usePublicRrpMap, formatPublicRrpForDestination } from "@/hooks/usePublicRrp";
import { PortraitCtaLink } from "@/components/ui/portrait-cta-link";
import SwipeAlternateProductImage from "@/components/product/SwipeAlternateProductImage";
import { useShippingDestination } from "@/lib/shippingDestination";
import { ECART_REEDITION_LABEL, formatCuratorialEditionLine, isEcartReedition } from "@/lib/editionLabel";

const transition: Transition = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };

function responsiveCloudinaryUrl(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com")) return url;
  const replaced = url.replace(/w_\d+/, `w_${width}`);
  if (replaced !== url) return replaced;
  return url.replace("/upload/", `/upload/w_${width},c_limit,f_auto,q_auto/`);
}

function pickSrcSet(url: string): string {
  return [300, 400, 600, 800].map((w) => `${responsiveCloudinaryUrl(url, w)} ${w}w`).join(", ");
}

/**
 * Derive small inventory badges for a curator-pick card.
 * Matches tags/edition strings to "Available Now" or explicit "Exclusive" labels shown
 * in the lower-left corner of product thumbnails.
 */
function inventoryBadgesForPick(pick: DesignerCuratorPick): string[] {
  const tags = (pick.tags || []).map((t) => t.toLowerCase());
  const edition = ((pick as any).edition || "").toLowerCase();
  const badges: string[] = [];
  if (tags.some((t) => /available[-\s]?now|in[-\s]?stock/.test(t))) {
    badges.push("Available Now");
  }
  if (edition.includes("exclusive") || tags.some((t) => /\bexclusive\b/.test(t))) {
    badges.push("Exclusive");
  }
  return badges;
}

interface NewInSpotlightProps {
  designer: Designer;
  showEyebrow?: boolean;
  variant?: "default" | "underlaid";
  /** Render these picks instead of the designer's own (e.g. Arnold Madsen → Dagmar's Clam pieces). */
  picksOverride?: DesignerCuratorPick[];
  /** Brand line + lightbox attribution used with picksOverride. */
  brandLabelOverride?: string;
  /** Designer slug used for lightbox links with picksOverride. */
  pickDesignerSlugOverride?: string;
  /** Full sibling catalogue used only for the lightbox "More from" strip. */
  relatedPicksOverride?: DesignerCuratorPick[];
}

const NewInSpotlight = ({ designer, showEyebrow = true, variant = "default", picksOverride, brandLabelOverride, pickDesignerSlugOverride, relatedPicksOverride }: NewInSpotlightProps) => {
  const navigate = useNavigate();
  const hasOverride = Array.isArray(picksOverride);
  const isParentBrand = !hasOverride && isParentBrandDesigner(designer);
  const { data: founderIsBrand = false } = useFounderIsBrand(
    isParentBrand ? undefined : designer.founder
  );
  const { data: simplePicks = [] } = useDesignerPicks(hasOverride ? undefined : designer.id, { publicOnly: true });
  const { data: groupedPicks = [] } = useGroupedDesignerPicks(
    isParentBrand ? designer : undefined,
    { publicOnly: true }
  );
  const picks: DesignerCuratorPick[] = hasOverride
    ? (picksOverride as DesignerCuratorPick[])
    : isParentBrand
      ? (groupedPicks as any as DesignerCuratorPick[])
      : simplePicks;

  const { data: publicRrpMap = {} } = usePublicRrpMap(picks.map((p) => p.id));
  const { data: instagramPosts = [] } = useDesignerInstagramPosts(designer.id);
  const dest = useShippingDestination();
  const isUnderlaid = variant === "underlaid";
  const [gridCols, setGridCols] = useState<3 | 4>(3);
  const [mobileGridCols, setMobileGridCols] = useState<1 | 2>(2);
  const [ctaPressed, setCtaPressed] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<PublicLightboxItem | null>(null);
  const igWithImages = instagramPosts.filter((p) => p.image_url);

  const portraitImage = designer.hero_image_url || designer.image_url;

  const toLightboxItem = (p: any): PublicLightboxItem => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        image_url: p.image_url,
        hover_image_url: p.hover_image_url,
        brand_name: brandLabelOverride || designer.name,
        materials: p.materials,
        materials_description: (p as any).materials_description ?? null,
        dimensions: p.dimensions,
        lead_time: (p as any).lead_time ?? null,
        origin: (p as any).origin ?? null,
        description: (p as any).description ?? null,
        category: p.category,
        subcategory: (p as any).subcategory ?? null,
        pdf_url: p.pdf_url || ((p as any).pdf_urls as any[] | null)?.[0]?.url || null,
        pdf_urls: ((p as any).pdf_urls as any) ?? null,
        designer_slug: pickDesignerSlugOverride || designer.slug,
        size_variants: (p as any).size_variants ?? null,
        variant_placeholder: (p as any).variant_placeholder ?? null,
        base_axis_label: (p as any).base_axis_label ?? null,
        top_axis_label: (p as any).top_axis_label ?? null,
        gallery_images: (p as any).gallery_images ?? null,
    variant_image_map: (p as any).variant_image_map ?? null,
  });

  const lightboxItems: PublicLightboxItem[] = useMemo(
    () => picks.map(toLightboxItem),
    [picks, designer.name, designer.slug, brandLabelOverride, pickDesignerSlugOverride]
  );

  // Sibling catalogue for the lightbox "More from" strip. Falls back to the
  // displayed picks when no override is supplied.
  const lightboxRelatedItems: PublicLightboxItem[] = useMemo(
    () => (relatedPicksOverride ? relatedPicksOverride.map(toLightboxItem) : lightboxItems),
    [relatedPicksOverride, lightboxItems]
  );

  // Name → slug map so brand/designer attribution lines are navigable.
  const { data: allDesigners = [] } = useAllDesigners();
  const slugByName = useMemo(() => {
    const map = new Map<string, string>();
    const key = (s: string) => s.trim().toLowerCase();
    for (const d of allDesigners) {
      if (d.name) map.set(key(d.name), d.slug);
      if ((d as any).display_name) map.set(key((d as any).display_name), d.slug);
      if (d.name?.includes(" - ")) map.set(key(d.name.split(" - ")[0]), d.slug);
    }
    return map;
  }, [allDesigners]);

  const resolveSlug = (label: string): string | null => {
    if (!label) return null;
    const normalizedLabel = label.trim().toLowerCase();
    const currentDesignerNames = [designer.name, designer.display_name]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toLowerCase());
    if (currentDesignerNames.includes(normalizedLabel)) return designer.slug;
    return slugByName.get(normalizedLabel) || null;
  };

  const displayName = designer.display_name || designer.name;
  const shareUrl = buildDesignerOgUrl(designer.name);

  // Extract only the first renderable paragraph from the biography
  // (the field contains media URLs, pipe-separated metadata, etc.)
  const firstBioParagraph = useMemo(() => {
    if (!designer.biography) return "";
    const blocks = designer.biography.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
    let text = "";
    for (const block of blocks) {
      const firstToken = block.split(/\s*\|\s*/)[0]?.trim() || "";
      // Skip blocks that start with a URL (media / video references)
      if (/^https?:\/\//i.test(firstToken) && !/\s/.test(firstToken)) continue;
      text = block;
      break;
    }
    // Truncate long paragraphs at a natural sentence-ending marker
    const breakAfter = "contemporary sensibility.";
    const idx = text.toLowerCase().indexOf(breakAfter.toLowerCase());
    if (idx !== -1) {
      text = text.slice(0, idx + breakAfter.length);
    }
    return text;
  }, [designer.biography]);

  const renderCuratorsPicksSection = ({
    barClassName = "flex items-center justify-between mb-6",
    titleClassName = "hidden md:block font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-foreground",
    mobileBadgeClassName = "px-4 py-1.5 rounded-full border border-foreground/20 bg-foreground/5 md:hidden",
    mobileTitleClassName = "font-display text-[11px] md:text-xs tracking-[0.2em] uppercase text-foreground font-semibold",
    fullWidthDesktop = false,
  }: {
    barClassName?: string;
    titleClassName?: string;
    mobileBadgeClassName?: string;
    mobileTitleClassName?: string;
    fullWidthDesktop?: boolean;
  } = {}) => (
    <>
      <div className={barClassName}>
        <div className="flex items-center gap-3">
          <h3 className={titleClassName}>
            Curators' Picks
          </h3>
          <div className={cn(mobileBadgeClassName)}>
            <h3 className={mobileTitleClassName}>Curators' Picks</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile toggle */}
          <button
            onClick={() => setMobileGridCols((prev) => (prev === 1 ? 2 : 1))}
            className="md:hidden flex items-center p-1.5 rounded transition-all hover:opacity-70"
            aria-label={`Switch to ${mobileGridCols === 1 ? 2 : 1} column grid`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              {mobileGridCols === 2 ? (
                <rect x="4" y="3" width="16" height="18" rx="1" fill="currentColor" />
              ) : (
                <>
                  <rect x="2" y="3" width="9" height="18" rx="1" fill="currentColor" />
                  <rect x="13" y="3" width="9" height="18" rx="1" fill="currentColor" />
                </>
              )}
            </svg>
          </button>
          {/* Desktop toggle */}
          {!fullWidthDesktop && <button
            onClick={() => setGridCols((prev) => (prev === 3 ? 4 : 3))}
            className="hidden md:flex items-center p-1.5 rounded transition-all hover:opacity-70"
            aria-label={`Switch to ${gridCols === 3 ? 4 : 3} column grid`}
            title={gridCols === 3 ? "Display 4" : "Display 3"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              {gridCols === 4 ? (
                <>
                  <rect x="2" y="3" width="6" height="18" rx="1" fill="currentColor" />
                  <rect x="10" y="3" width="6" height="18" rx="1" fill="currentColor" />
                  <rect x="18" y="3" width="4" height="18" rx="1" fill="currentColor" />
                </>
              ) : (
                <>
                  <rect x="2" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                  <rect x="8" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                  <rect x="14" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                  <rect x="20" y="3" width="2" height="18" rx="1" fill="currentColor" />
                </>
              )}
            </svg>
          </button>}
        </div>
      </div>

      <div className={cn("grid items-stretch gap-6 md:gap-8", mobileGridCols === 1 ? "grid-cols-1" : "grid-cols-2", fullWidthDesktop ? "md:grid-cols-3" : gridCols === 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
        {picks.map((pick) => {
          const alternateImage = pick.hover_image_url
            || ((pick as any).gallery_images as string[] | null | undefined)?.find((url) => url && url !== pick.image_url)
            || null;
          const showReedition = isEcartReedition({
            designerName: designer.name,
            founder: designer.founder,
            parentBrand: brandLabelOverride,
          });

          return (
            <div
              key={pick.id}
              className="group flex h-full min-w-0 flex-col justify-between cursor-pointer"
              onClick={() => {
                const item = lightboxItems.find((li) => li.id === pick.id);
                if (item) setLightboxItem(item);
              }}
            >
              <div className="relative aspect-square w-full flex-none overflow-hidden bg-[hsl(var(--product-canvas))]">
                <SwipeAlternateProductImage
                  primarySrc={responsiveCloudinaryUrl(pick.image_url, 600)}
                  primarySrcSet={pickSrcSet(pick.image_url)}
                  alternateSrc={alternateImage ? responsiveCloudinaryUrl(alternateImage, 600) : null}
                  alternateSrcSet={alternateImage ? pickSrcSet(alternateImage) : undefined}
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                  alt={pick.title}
                  primaryClassName="!h-full !w-full !max-h-full !max-w-full !object-contain object-center mix-blend-multiply !p-6"
                  alternateClassName="!h-full !w-full !max-h-full !max-w-full !object-contain object-center mix-blend-multiply !p-6"
                />
                {formatCuratorialEditionLine(pick) && (
                  <p className="pointer-events-none absolute left-6 top-4 z-10 bg-transparent text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--edition-foreground))] antialiased">
                    {formatCuratorialEditionLine(pick)}
                  </p>
                )}
                {showReedition && (
                  <p className="pointer-events-none absolute left-6 top-4 z-10 bg-transparent text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--edition-foreground))] antialiased">
                    {ECART_REEDITION_LABEL}
                  </p>
                )}
                {/* Inventory badges — lower-left of the frame */}
                <InventoryBadgeStack
                  badges={inventoryBadgesForPick(pick)}
                  className="absolute bottom-3 left-3 z-10"
                />
                <div className="hidden md:block absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-1.5 bg-black/40 rounded-md text-white/90 backdrop-blur-sm">
                    <Maximize2 className="h-3 w-3" />
                  </div>
                </div>
                <ProductCardDescriptionOverlay description={(pick as any).description} />
                {(pick.pdf_url || (pick.pdf_urls && pick.pdf_urls.length > 0)) && (
                  <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <SpecSheetButton
                      pdfUrl={pick.pdf_url}
                      pdfUrls={pick.pdf_urls as any}
                      brandName={designer.name}
                      productName={pick.title}
                      variant="icon"
                    />
                  </div>
                )}
              </div>

              <div className="mt-3 flex h-12 w-full items-start justify-between gap-3">
                <div className="flex min-w-0 max-w-[70%] flex-col text-left">
                {(() => {
                  const composed = composeTitle(pick.title, pick.subtitle);
                  // Editor brands (e.g. De La Espada) embed the author in the title:
                  // "Azores Sofa by Luca Nichetto" → brand line = Luca Nichetto.
                  const attribution = isParentBrand
                    ? splitTitleAttribution(composed.title, pick.subtitle)
                    : { title: composed.title, designer: undefined as string | undefined };
                  // Parent brand page: identify the individual designer behind each pick.
                  // Individual designer page: identify the parent brand, not the designer
                  // whose name is already the page heading (e.g. ECART on J.-M. Frank).
                  const attributedDesigner = isParentBrand
                    ? (attribution.designer || (pick as any).designer_name || "").trim()
                    : "";
                  const parentBrand = !isParentBrand && founderIsBrand && designer.founder
                    && ![designer.name, designer.display_name].includes(designer.founder)
                    ? designer.founder.trim()
                    : "";

                  // "for X" / "by X" subtitles are editor attribution, not a brand line.
                  // On an individual designer page they belong appended to the product name.
                  const editorSuffix = !isParentBrand
                    ? (composed.remainingSubtitle || pick.subtitle || "").trim().match(/^(for|by)\s+.+/i)?.[0] || ""
                    : "";

                  // A finish/material subtitle ("Clear", "Tarnished Silver") is a variant,
                  // never a brand — it must not replace the maker on the brand line.
                  const subtitleIsFinish = isFinishSubtitle(pick.subtitle);
                  const brandLine = (
                    brandLabelOverride
                    || attributedDesigner
                    || parentBrand
                    || (editorSuffix || subtitleIsFinish ? "" : composed.remainingSubtitle)
                    || (editorSuffix || subtitleIsFinish ? "" : pick.subtitle)
                    || displayName
                    || designer.name
                    || ""
                  ).trim();
                  const productLine = editorSuffix
                    && !attribution.title.toLowerCase().includes(editorSuffix.toLowerCase())
                    ? `${attribution.title} ${editorSuffix}`
                    : attribution.title;
                  const brandSlug = resolveSlug(brandLine);
                  return (
                    <>
                      {/* Designer / brand — top, prominent */}
                       {brandSlug ? (
                          <Link
                            to={`/designers/${brandSlug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block w-full truncate whitespace-nowrap font-body text-[10px] font-semibold uppercase tracking-wider text-foreground antialiased hover:underline underline-offset-4 decoration-foreground/40 transition-colors"
                          >
                            {brandLine}
                          </Link>
                         ) : brandLine ? (
                          <span className="block w-full truncate whitespace-nowrap font-body text-[10px] font-semibold uppercase tracking-wider text-foreground antialiased">
                            {brandLine}
                          </span>
                         ) : (
                           <span aria-hidden="true" className="block h-5" />
                         )}
                      {/* Product name — secondary, elegant italic */}
                      <h3 className="mt-0.5 line-clamp-2 font-body text-xs font-medium leading-snug text-foreground antialiased">
                        {productLine}
                      </h3>
                    </>
                  );
                })()}
              </div>
              {/* Price — bottom right, aligned to product title baseline */}
              <div className="min-w-fit shrink-0 whitespace-nowrap">
                <p className="whitespace-nowrap font-body text-xs font-semibold text-foreground antialiased">
                  {formatPublicRrpForDestination(publicRrpMap[pick.id], dest.currency) || "Price upon Request"}
                </p>
              </div>
            </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop-only underlaid split canvas (Emmanuel Babled et al.) */}
      {isUnderlaid && (
        <section className="hidden md:block w-full bg-transparent">
          <div className="grid grid-cols-2 gap-x-10 items-start w-full">
            {/* Left Column — constrained editorial hero */}
            <div className="flex flex-col">
              <div className="aspect-[16/10] max-h-[450px] w-full overflow-hidden bg-[hsl(var(--canvas))]">
                <CldPicture
                  src={portraitImage}
                  alt={`${displayName} portrait`}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: (designer as any).hero_image_position || "center" }}
                />
              </div>
            </div>

            {/* Right Column — compact biography stack + From the Studio */}
            <div className="flex flex-col justify-start pt-0 pb-3">
              <div className="flex items-center gap-3 w-full">
                <h1 className="text-2xl font-serif font-semibold tracking-wide text-black antialiased">
                  {displayName}
                </h1>
                <ShareMenu
                  url={shareUrl}
                  message={`Maison Affluency · ${displayName}: ${shareUrl}`}
                  className="flex items-center p-1 -m-1 text-foreground/40 hover:text-foreground transition-colors"
                  iconSize="w-4 h-4 md:w-5 md:h-5"
                  showLabel={false}
                />
              </div>

              <p className="mt-4 text-justify w-full text-xs lg:text-sm text-neutral-600">
                {renderParagraph(firstBioParagraph)}
              </p>

              <div className="mt-5 w-full">
                <PortraitCtaLink
                  label="View The Full Portrait"
                  className="text-[10px] uppercase tracking-widest text-neutral-800 font-medium inline-flex items-center gap-4"
                  onClick={() => {
                    if (ctaPressed) return;
                    setCtaPressed(true);
                    window.setTimeout(() => navigate(`/designers/${designer.slug}/biography?from=new-in`), 380);
                  }}
                />
              </div>

              {igWithImages.length > 0 && (
                <div className="mt-6 pt-4 border-t border-neutral-100 w-full flex flex-col">
                  <div className="pl-6 md:pl-10 flex flex-col items-center">
                    <div className="flex gap-3 items-center h-20 md:h-24 overflow-hidden flex-shrink-0 self-start w-full">
                      {igWithImages.slice(0, 5).map((post) => (
                        <a
                          key={post.id}
                          href={post.post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block h-full aspect-square flex-shrink-0 overflow-hidden bg-[hsl(var(--canvas))]"
                        >
                          <CldPicture
                            src={post.image_url!}
                            alt={post.caption || `${displayName} — From the Studio`}
                            priority
                            widths={[128, 192]}
                            mobileWidths={[128, 192]}
                            sizes="(min-width: 768px) 106px, 80px"
                            className="h-full w-full object-cover object-center transition-transform duration-700 ease-out scale-[1.10] group-hover:scale-[1.15]" />
                          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-300 flex items-center justify-center">
                            <Instagram className="h-4 w-4 text-background opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                        </a>
                      ))}
                    </div>
                    <span className="relative text-[10px] uppercase tracking-[0.18em] text-neutral-400 font-normal mt-3 md:mt-4 md:mb-0">
                      <Instagram className="absolute right-full top-1/2 mr-2 w-3.5 h-3.5 -translate-y-1/2" strokeWidth={1.5} />
                      From the Studio
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full-width Curators' Picks — independent from either hero column */}
          <div className="mt-4 w-full">
            {renderCuratorsPicksSection({
              barClassName: "flex justify-between items-center w-full border-b border-neutral-100 py-2 mt-2 mb-3 text-[11px] uppercase tracking-widest text-neutral-800",
              titleClassName: "hidden md:block font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-800",
              mobileBadgeClassName: "px-4 py-1.5 rounded-full border border-neutral-800/20 bg-neutral-800/5 md:hidden",
              mobileTitleClassName: "font-display text-[11px] md:text-xs tracking-[0.2em] uppercase text-neutral-800 font-semibold",
              fullWidthDesktop: true,
            })}
          </div>
        </section>
      )}

      {/* Portrait + Biography — side by side */}
      <section className={cn(
        "max-w-[1380px] mx-auto px-6 pt-10 md:pt-16 pb-4 md:pb-6",
        isUnderlaid && "md:hidden"
      )}>
        <div className="flex flex-col md:flex-row gap-8 md:gap-14 items-start">
          {/* Portrait */}
          <motion.div
            key={`portrait-${designer.slug}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="w-full md:w-[38%] flex-shrink-0"
          >
            <div className="aspect-[3/2] md:aspect-[4/5] overflow-hidden rounded-none bg-muted relative">
              <CldPicture
                src={portraitImage}
                alt={`${displayName} portrait`}
                className="w-full h-full object-cover"
                style={{ objectPosition: (designer as any).hero_image_position || "center" }}
              />
            </div>
          </motion.div>

          {/* Name + Bio + CTA */}
          <motion.div
            key={`bio-${designer.slug}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: 0.2 }}
            className="flex-1 flex flex-col justify-start"
          >
            {showEyebrow && (
              <span className="font-body text-[10px] uppercase tracking-[0.35em] text-muted-foreground mb-2 block">
                New In
              </span>
            )}
            <div className="flex items-center gap-3 mb-8">
              <h2 className="font-display text-2xl md:text-3xl lg:text-[2.1rem] text-foreground tracking-[0.12em] uppercase">
                {displayName}
              </h2>
              <ShareMenu
                url={shareUrl}
                message={`Maison Affluency · New In · ${displayName}: ${shareUrl}`}
                className="flex items-center p-1 -m-1 text-foreground/40 hover:text-foreground transition-colors"
                iconSize="w-4 h-4 md:w-5 md:h-5"
                showLabel={false}
              />
            </div>

            <p className="font-body text-sm md:text-base leading-relaxed text-foreground/85 text-left">
              {renderParagraph(firstBioParagraph)}
            </p>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => {
                  if (ctaPressed) return;
                  setCtaPressed(true);
                  window.setTimeout(() => navigate(`/designers/${designer.slug}/biography?from=new-in`), 380);
                }}
                className="group relative inline-flex items-center font-body text-xs uppercase tracking-[0.25em] text-foreground hover:text-primary transition-colors duration-300"
              >
                <span
                  className={cn(
                    "relative inline-flex items-center whitespace-nowrap pl-0 pr-14 transition-[padding] duration-300",
                    "group-hover:pl-20 group-hover:pr-0",
                    ctaPressed && "pl-20 pr-0"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none absolute left-0 top-1/2 h-px w-12 -translate-y-1/2 bg-current opacity-0 transition-all duration-300",
                      "translate-x-2 group-hover:translate-x-0 group-hover:opacity-100",
                      ctaPressed && "translate-x-0 opacity-100"
                    )}
                  />
                  <span className="relative z-10">View The Full Portrait</span>
                  <span
                    className={cn(
                      "pointer-events-none absolute right-5 top-1/2 h-px w-8 -translate-y-1/2 bg-current opacity-100 transition-all duration-300",
                      "translate-x-0 group-hover:translate-x-6 group-hover:opacity-0",
                      ctaPressed && "translate-x-6 opacity-0"
                    )}
                  />
                  <ArrowRight
                    className={cn(
                      "pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-0",
                      ctaPressed && "-translate-x-1 opacity-0"
                    )}
                  />
                </span>
              </button>
            </div>

            {/* From the Studio */}
            {igWithImages.length > 0 && (
              <div className="mt-10 pt-8 border-t border-border/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-foreground/15" />
                  <div className="relative shrink-0">
                    <Instagram className="absolute right-full top-1/2 mr-2 w-3.5 h-3.5 -translate-y-1/2 text-foreground/60" />
                    <span className="block font-display text-[10px] md:text-[11px] tracking-[0.2em] uppercase text-foreground/60 font-semibold">
                      From the Studio
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-foreground/15" />
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
                  {igWithImages.slice(0, 5).map((post, index) => (
                    <a
                      key={post.id}
                      href={post.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group relative block aspect-square overflow-hidden bg-muted ${index >= 3 ? "hidden md:block" : ""}`}
                    >
                      <CldPicture
                        src={post.image_url!}
                        alt={post.caption || `${displayName} — From the Studio`}
                        priority
                        widths={[128, 192]}
                        mobileWidths={[128, 192]}
                        sizes="(min-width: 768px) 106px, 30vw"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out scale-[1.10] group-hover:scale-[1.15]" />
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-300 flex items-center justify-center">
                        <Instagram className="h-4 w-4 text-background opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Separator */}
      <div className={cn(
        "max-w-[1380px] mx-auto px-6",
        isUnderlaid && "md:hidden"
      )}>
        <div className="border-t border-border/40" />
      </div>

      {/* Curators' Picks */}
      <section className={cn(
        "max-w-[1380px] mx-auto px-6 pt-4 md:pt-6 pb-6 md:pb-24",
        isUnderlaid && "md:hidden"
      )}>
        {renderCuratorsPicksSection()}
      </section>

      <PublicProductLightbox
        product={lightboxItem}
        allPicks={lightboxRelatedItems}
        onClose={() => setLightboxItem(null)}
        onSelectRelated={(item) => setLightboxItem(item)}
      />
    </>
  );
};

export default NewInSpotlight;
